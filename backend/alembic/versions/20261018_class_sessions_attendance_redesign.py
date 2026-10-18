"""
Attendance redesign: class sessions, audit log, job runs, record provenance and
metrics-exclusion flags, enrollment dates; backfill legacy attendance into sessions.

Implements DOMAIN_RULES.md section 12 with the v2 amendments of section 13
(13.1 kind + partial unique, 13.2, 13.5 exclusion flags, 13.6 event columns,
13.7 cohort_since, 13.14 indexes).

Upgrade
  1. DDL: enum value attendance_status.'excused'; tables class_sessions,
     attendance_audit_log, job_runs; attendance_records.session_id/source/
     excluded_from_metrics/exclusion_reason; students.enrolled_on/cohort_since;
     class_schedules CHECK (end_time > start_time); attendance_records student
     FK -> ON DELETE RESTRICT (was CASCADE) and subject FK -> RESTRICT.
  2. Backfill attendance_records.source: untouched auto-absences -> system_auto;
     marked_by admin -> admin, faculty -> teacher (any method); face + student -> student_face;
     everything else -> legacy.
  3. Backfill class_sessions from each (subject_id, date) group of records, mapped to
     the single class_schedules row of that subject on that weekday; link records.
  4. Set excluded_from_metrics (+ exclusion_reason) per 13.5.
  5. Swap uniqueness: UNIQUE(student_id, session_id) + partial legacy unique,
     drop UNIQUE(student_id, subject_id, date).
  6. Insert system_settings 'attendance_policy' defaults if the key is absent.
  7. One 'legacy_backfill' attendance_audit_log row with the counts.
  No attendance row is deleted and no status is changed. updated_at of attendance
  rows is preserved (user triggers are disabled during the backfill).

Downgrade
  Reverses the DDL (drops new tables/columns, restores the old unique constraint and
  the original FK actions). It FAILS LOUDLY when the old unique constraint cannot be
  restored (a student has two sessions of one subject on one day) or when 'excused'
  records exist. The enum value 'excused' cannot be removed from attendance_status
  (PostgreSQL has no DROP VALUE); it is left in place and is harmless to old code
  as long as no row uses it. attendance_audit_log / job_runs history is lost on
  downgrade: take a pg_dump first (13.15). The 'attendance_policy' setting is kept.

Revision ID: o20261018_class_sessions
Revises: n20251103_payload_receipts
Create Date: 2026-10-18
"""
import json
import logging

from alembic import op
import sqlalchemy as sa


revision = 'o20261018_class_sessions'
down_revision = 'n20251103_payload_receipts'
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")

APP_TZ = "Asia/Kathmandu"
CHECKIN_OPENS_MINUTES_BEFORE = 10  # attendance_policy default (DOMAIN_RULES 2)

# Weekday name as stored in the day_of_week enum, indexed by EXTRACT(DOW) + 1 (Sunday = 0).
DOW_NAME_SQL = (
    "(ARRAY['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'])"
    "[EXTRACT(DOW FROM {col})::int + 1]"
)

REAL_SOURCES_SQL = "('teacher', 'admin', 'student_face')"
TAKEN_STATUSES_SQL = "('present', 'late', 'absent')"


def _exec(conn, sql, **params):
    return conn.execute(sa.text(sql), params)


def _scalar(conn, sql, **params):
    return conn.execute(sa.text(sql), params).scalar()


def _pairs(conn, sql, **params):
    return {str(k): int(v) for k, v in conn.execute(sa.text(sql), params).all()}


def _single_col_fk_names(conn, table, column, ref_table):
    """Names of single-column FKs table(column) -> ref_table (live DB names vary)."""
    return list(conn.execute(sa.text("""
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND n.nspname = current_schema()
          AND t.relname = :table
          AND a.attname = :column
          AND array_length(c.conkey, 1) = 1
          AND c.confrelid = CAST(:ref AS regclass)
        ORDER BY c.conname
    """), {"table": table, "column": column, "ref": ref_table}).scalars())


def _replace_fk(conn, table, column, ref_table, name, ondelete):
    for existing in _single_col_fk_names(conn, table, column, ref_table):
        _exec(conn, f'ALTER TABLE {table} DROP CONSTRAINT "{existing}"')
    action = f" ON DELETE {ondelete}" if ondelete else ""
    _exec(conn, f'ALTER TABLE {table} ADD CONSTRAINT "{name}" FOREIGN KEY ({column}) '
                f'REFERENCES {ref_table} (id){action}')


# --------------------------------------------------------------------------- upgrade

def upgrade():
    # 0. Enum value. ADD VALUE must be committed before the value can be used, so it runs
    #    in its own autocommit block; the backfill below never uses 'excused'.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'excused'")

    conn = op.get_bind()
    _ddl(conn)
    context = _backfill(conn)
    _swap_uniqueness(conn)
    context["policy_setting_inserted"] = _insert_policy_setting(conn)
    context["tracking_start_date"] = _scalar(
        conn, "SELECT value->>'tracking_start_date' FROM system_settings WHERE key = 'attendance_policy'")

    _exec(conn, """
        INSERT INTO attendance_audit_log (action, changed_by, reason, context)
        VALUES ('legacy_backfill', NULL, :reason, CAST(:context AS jsonb))
    """, reason=("Alembic revision o20261018_class_sessions: legacy attendance mapped to class "
                 "sessions; provenance and metrics-exclusion flags backfilled. No record deleted "
                 "and no status changed."),
         context=json.dumps(context, default=str, sort_keys=True))
    log.info("legacy_backfill summary: %s", json.dumps(context, default=str, sort_keys=True))


def _ddl(conn):
    # students
    _exec(conn, "ALTER TABLE students ADD COLUMN enrolled_on date NULL, ADD COLUMN cohort_since date NULL")

    # class_schedules
    _exec(conn, "ALTER TABLE class_schedules ADD CONSTRAINT ck_class_schedule_time_order "
                "CHECK (end_time > start_time)")

    # class_sessions
    _exec(conn, """
        CREATE TABLE class_sessions (
            id serial PRIMARY KEY,
            schedule_id integer NULL
                CONSTRAINT fk_class_sessions_schedule REFERENCES class_schedules (id) ON DELETE SET NULL,
            kind varchar(16) NOT NULL DEFAULT 'regular',
            subject_id integer NOT NULL
                CONSTRAINT fk_class_sessions_subject REFERENCES subjects (id) ON DELETE RESTRICT,
            faculty_id integer NOT NULL
                CONSTRAINT fk_class_sessions_faculty REFERENCES faculties (id) ON DELETE RESTRICT,
            semester integer NOT NULL,
            term_id integer NULL
                CONSTRAINT fk_class_sessions_term REFERENCES semester_configurations (id) ON DELETE RESTRICT,
            session_date date NOT NULL,
            start_time time NOT NULL,
            end_time time NOT NULL,
            teacher_id integer NULL
                CONSTRAINT fk_class_sessions_teacher REFERENCES teachers (id) ON DELETE SET NULL,
            status varchar(16) NOT NULL DEFAULT 'scheduled',
            attendance_taken_at timestamptz NULL,
            submitted_at timestamptz NULL,
            submitted_by integer NULL
                CONSTRAINT fk_class_sessions_submitted_by REFERENCES users (id) ON DELETE RESTRICT,
            finalized_at timestamptz NULL,
            cancelled_at timestamptz NULL,
            cancelled_by integer NULL
                CONSTRAINT fk_class_sessions_cancelled_by REFERENCES users (id) ON DELETE RESTRICT,
            cancellation_reason text NULL,
            cancelled_by_event_id integer NULL
                CONSTRAINT fk_class_sessions_cancelled_by_event REFERENCES academic_events (id) ON DELETE SET NULL,
            review_required boolean NOT NULL DEFAULT false,
            review_reason text NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT uq_class_session_slot UNIQUE (subject_id, faculty_id, semester, session_date, start_time),
            CONSTRAINT ck_class_session_time_order CHECK (end_time > start_time),
            CONSTRAINT ck_class_session_status CHECK (status IN ('scheduled', 'held', 'cancelled')),
            CONSTRAINT ck_class_session_kind CHECK (kind IN ('regular', 'makeup'))
        )
    """)
    for stmt in (
        "CREATE UNIQUE INDEX uq_class_session_schedule_date ON class_sessions (schedule_id, session_date) "
        "WHERE schedule_id IS NOT NULL AND kind = 'regular'",
        "CREATE INDEX ix_class_sessions_session_date ON class_sessions (session_date)",
        "CREATE INDEX ix_class_sessions_cohort_date ON class_sessions (faculty_id, semester, session_date)",
        "CREATE INDEX ix_class_sessions_status ON class_sessions (status)",
        "CREATE INDEX ix_class_sessions_teacher_date ON class_sessions (teacher_id, session_date)",
        "CREATE INDEX ix_class_sessions_held_unfinalized ON class_sessions (status, finalized_at) "
        "WHERE status = 'held' AND finalized_at IS NULL",
        "CREATE INDEX ix_class_sessions_cancelled_by_event ON class_sessions (cancelled_by_event_id) "
        "WHERE cancelled_by_event_id IS NOT NULL",
    ):
        _exec(conn, stmt)
    # Same updated_at trigger function the other tables use (exists in the live schema).
    _exec(conn, """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
                CREATE TRIGGER update_class_sessions_updated_at
                    BEFORE UPDATE ON class_sessions
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
    """)

    # attendance_audit_log
    _exec(conn, """
        CREATE TABLE attendance_audit_log (
            id serial PRIMARY KEY,
            attendance_record_id integer NULL
                CONSTRAINT fk_attendance_audit_record REFERENCES attendance_records (id) ON DELETE SET NULL,
            session_id integer NULL
                CONSTRAINT fk_attendance_audit_session REFERENCES class_sessions (id) ON DELETE SET NULL,
            student_id integer NULL,
            action varchar(32) NOT NULL,
            old_status varchar(16) NULL,
            new_status varchar(16) NULL,
            old_source varchar(16) NULL,
            new_source varchar(16) NULL,
            changed_by integer NULL
                CONSTRAINT fk_attendance_audit_changed_by REFERENCES users (id) ON DELETE RESTRICT,
            changed_at timestamptz NOT NULL DEFAULT now(),
            reason text NULL,
            context jsonb NULL
        )
    """)
    _exec(conn, "CREATE INDEX ix_attendance_audit_log_record ON attendance_audit_log (attendance_record_id)")
    _exec(conn, "CREATE INDEX ix_attendance_audit_log_session ON attendance_audit_log (session_id)")
    _exec(conn, "CREATE INDEX ix_attendance_audit_log_changed_at ON attendance_audit_log (changed_at)")

    # job_runs
    _exec(conn, """
        CREATE TABLE job_runs (
            id serial PRIMARY KEY,
            job_name varchar(64) NOT NULL,
            started_at timestamptz NOT NULL DEFAULT now(),
            finished_at timestamptz NULL,
            status varchar(16) NOT NULL DEFAULT 'running',
            triggered_by integer NULL
                CONSTRAINT fk_job_runs_triggered_by REFERENCES users (id) ON DELETE SET NULL,
            params jsonb NULL,
            result jsonb NULL,
            error text NULL,
            CONSTRAINT ck_job_run_status CHECK (status IN ('running', 'success', 'failed', 'skipped'))
        )
    """)
    _exec(conn, "CREATE INDEX ix_job_runs_job_started ON job_runs (job_name, started_at)")

    # attendance_records: new columns, FK to sessions, provenance CHECK, index
    _exec(conn, """
        ALTER TABLE attendance_records
            ADD COLUMN session_id integer NULL
                CONSTRAINT fk_attendance_session REFERENCES class_sessions (id) ON DELETE RESTRICT,
            ADD COLUMN source varchar(16) NOT NULL DEFAULT 'legacy',
            ADD COLUMN excluded_from_metrics boolean NOT NULL DEFAULT false,
            ADD COLUMN exclusion_reason varchar(64) NULL,
            ADD CONSTRAINT ck_attendance_source
                CHECK (source IN ('teacher', 'admin', 'student_face', 'system_auto', 'legacy'))
    """)
    _exec(conn, "CREATE INDEX idx_attendance_session_id ON attendance_records (session_id)")

    # Attendance is a legal record: students with attendance can no longer be deleted
    # (was ON DELETE CASCADE); subject FK made explicit RESTRICT (was NO ACTION).
    _replace_fk(conn, "attendance_records", "student_id", "students",
                "attendance_records_student_id_fkey", "RESTRICT")
    _replace_fk(conn, "attendance_records", "subject_id", "subjects",
                "fk_attendance_subject", "RESTRICT")


def _backfill(conn):
    ctx = {"revision": revision}
    ctx["records_total"] = _scalar(conn, "SELECT count(*) FROM attendance_records")
    ctx["records_by_status_before"] = _pairs(
        conn, "SELECT coalesce(status::text, 'NULL'), count(*) FROM attendance_records GROUP BY 1")

    # Keep updated_at untouched: the backfill is not an edit of the attendance facts.
    _exec(conn, "ALTER TABLE attendance_records DISABLE TRIGGER USER")

    # 2. Provenance (DOMAIN_RULES 12.2 + coordinator decision 2026-10-18). Rules are evaluated
    #    in order: untouched auto-absences stay system_auto; any row whose marked_by is an
    #    admin/faculty user was written or last edited by that user (whatever the method or
    #    location, e.g. a face check-in later corrected by an admin) -> admin/teacher.
    _exec(conn, """
        UPDATE attendance_records ar
        SET source = s.src
        FROM (
            SELECT r.id,
                   CASE
                     WHEN r.location = 'AUTO_ABSENT_SYSTEM' AND r.method = 'other' AND r.marked_by IS NULL
                       THEN 'system_auto'
                     WHEN u.role = 'admin' THEN 'admin'
                     WHEN u.role = 'faculty' THEN 'teacher'
                     WHEN r.method = 'face' AND u.role = 'student' THEN 'student_face'
                     ELSE 'legacy'
                   END AS src
            FROM attendance_records r
            LEFT JOIN users u ON u.id = r.marked_by
        ) s
        WHERE s.id = ar.id AND s.src <> 'legacy'
    """)
    ctx["records_by_source"] = _pairs(conn, "SELECT source, count(*) FROM attendance_records GROUP BY 1")

    # 3. Sessions (DOMAIN_RULES 12.3 + 13.3/13.5/13.6).
    _exec(conn, f"""
        CREATE TEMP TABLE _bf_groups AS
        WITH g AS (
            SELECT ar.subject_id,
                   ar.date AS session_date,
                   {DOW_NAME_SQL.format(col='ar.date')} AS dow,
                   count(*) AS n_records,
                   bool_or(ar.source IN {REAL_SOURCES_SQL} AND ar.status IN {TAKEN_STATUSES_SQL}) AS any_real,
                   bool_and(ar.status IS NOT DISTINCT FROM 'cancelled') AS all_cancelled,
                   bool_or(ar.source = 'system_auto') AS has_auto,
                   min(ar.created_at) FILTER (
                       WHERE ar.source IN {REAL_SOURCES_SQL} AND ar.status IN {TAKEN_STATUSES_SQL}
                   ) AS first_real_at
            FROM attendance_records ar
            GROUP BY ar.subject_id, ar.date
        )
        SELECT g.*, m.n_match, m.schedule_id
        FROM g
        CROSS JOIN LATERAL (
            SELECT count(*) AS n_match, min(cs.id) AS schedule_id
            FROM class_schedules cs
            WHERE cs.subject_id = g.subject_id AND cs.day_of_week::text = g.dow
        ) m
    """)
    ctx["groups_total"] = _scalar(conn, "SELECT count(*) FROM _bf_groups")
    ctx["groups_unmapped_no_schedule"] = _scalar(conn, "SELECT count(*) FROM _bf_groups WHERE n_match = 0")
    ctx["groups_unmapped_ambiguous"] = _scalar(conn, "SELECT count(*) FROM _bf_groups WHERE n_match > 1")

    _exec(conn, """
        CREATE TEMP TABLE _bf_sessions AS
        SELECT g.*,
               cs.faculty_id, cs.semester, cs.start_time, cs.end_time, cs.teacher_id,
               ev.id AS event_id, ev.title AS event_title,
               t.n_terms, t.term_id,
               CASE
                 WHEN g.any_real THEN 'held'
                 WHEN ev.id IS NOT NULL OR g.all_cancelled THEN 'cancelled'
                 ELSE 'scheduled'
               END AS status
        FROM _bf_groups g
        JOIN class_schedules cs ON cs.id = g.schedule_id
        LEFT JOIN LATERAL (
            SELECT e.id, e.title
            FROM academic_events e
            WHERE e.event_type::text = 'CANCELLED_CLASS'
              AND e.is_active
              AND g.session_date BETWEEN e.start_date AND coalesce(e.end_date, e.start_date)
              AND (e.subject_id IS NULL OR e.subject_id = g.subject_id)
              AND (e.faculty_id IS NULL OR e.faculty_id = cs.faculty_id)
              AND (e.start_time IS NULL OR e.end_time IS NULL
                   OR (e.start_time < cs.end_time AND cs.start_time < e.end_time))
            ORDER BY e.id
            LIMIT 1
        ) ev ON true
        CROSS JOIN LATERAL (
            SELECT count(*) AS n_terms,
                   CASE WHEN count(*) = 1 THEN min(sc.id) END AS term_id
            FROM semester_configurations sc
            WHERE sc.is_active AND g.session_date BETWEEN sc.start_date AND sc.end_date
        ) t
        WHERE g.n_match = 1
    """)
    ctx["sessions_term_ambiguous"] = _scalar(conn, "SELECT count(*) FROM _bf_sessions WHERE n_terms > 1")

    _exec(conn, """
        INSERT INTO class_sessions (
            schedule_id, kind, subject_id, faculty_id, semester, term_id, session_date,
            start_time, end_time, teacher_id, status, attendance_taken_at, finalized_at,
            cancelled_at, cancellation_reason, cancelled_by_event_id, review_required, review_reason
        )
        SELECT s.schedule_id, 'regular', s.subject_id, s.faculty_id, s.semester, s.term_id, s.session_date,
               s.start_time, s.end_time, s.teacher_id, s.status,
               CASE WHEN s.status = 'held' THEN s.first_real_at END,
               CASE WHEN s.status = 'held' AND s.has_auto THEN now() END,
               CASE WHEN s.status = 'cancelled' THEN now() END,
               CASE
                 WHEN s.status = 'cancelled' AND s.event_id IS NOT NULL
                   THEN 'Calendar event: ' || s.event_title
                 WHEN s.status = 'cancelled'
                   THEN 'Legacy backfill: every record of this class was marked cancelled'
               END,
               CASE WHEN s.status = 'cancelled' THEN s.event_id END,
               (s.status = 'held' AND s.event_id IS NOT NULL),
               CASE WHEN s.status = 'held' AND s.event_id IS NOT NULL
                    THEN 'Calendar event: ' || s.event_title
                         || ' covers this class but attendance was recorded (legacy backfill)'
               END
        FROM _bf_sessions s
        ORDER BY s.session_date, s.start_time, s.subject_id
    """)

    _exec(conn, """
        UPDATE attendance_records ar
        SET session_id = cs.id
        FROM class_sessions cs
        WHERE cs.subject_id = ar.subject_id
          AND cs.session_date = ar.date
          AND ar.session_id IS NULL
    """)
    ctx["sessions_by_status"] = _pairs(conn, "SELECT status, count(*) FROM class_sessions GROUP BY 1")
    ctx["sessions_finalized"] = _scalar(conn, "SELECT count(*) FROM class_sessions WHERE finalized_at IS NOT NULL")
    ctx["sessions_review_required"] = _scalar(conn, "SELECT count(*) FROM class_sessions WHERE review_required")
    ctx["sessions_cancelled_by_event"] = _scalar(
        conn, "SELECT count(*) FROM class_sessions WHERE cancelled_by_event_id IS NOT NULL")
    ctx["sessions_without_term"] = _scalar(conn, "SELECT count(*) FROM class_sessions WHERE term_id IS NULL")
    ctx["records_mapped"] = _scalar(conn, "SELECT count(*) FROM attendance_records WHERE session_id IS NOT NULL")
    ctx["records_unmapped"] = _scalar(conn, "SELECT count(*) FROM attendance_records WHERE session_id IS NULL")

    # 4. Metrics exclusion (13.5). A row matching several criteria keeps the first reason
    #    in this order; criteria_matches counts every criterion independently.
    enrollment_start = f"coalesce(st.enrolled_on, (st.created_at AT TIME ZONE '{APP_TZ}')::date)"
    criteria = {
        "legacy_unheld_session":
            "ar.source = 'system_auto' AND (cs.id IS NULL OR cs.status <> 'held')",
        "outside_term":
            "NOT EXISTS (SELECT 1 FROM semester_configurations sc "
            "WHERE sc.is_active AND ar.date BETWEEN sc.start_date AND sc.end_date)",
        "recorded_before_class":
            f"ar.source <> 'system_auto' AND cs.id IS NOT NULL AND ar.created_at IS NOT NULL "
            f"AND ar.created_at < ((cs.session_date + cs.start_time) AT TIME ZONE '{APP_TZ}') "
            f"- make_interval(mins => {CHECKIN_OPENS_MINUTES_BEFORE})",
        "before_enrollment":
            f"ar.date < {enrollment_start}",
    }
    base_from = ("FROM attendance_records ar "
                 "JOIN students st ON st.id = ar.student_id "
                 "LEFT JOIN class_sessions cs ON cs.id = ar.session_id")
    ctx["exclusion_criteria_matches"] = {
        name: _scalar(conn, f"SELECT count(*) {base_from} WHERE {cond}") for name, cond in criteria.items()
    }
    reason_case = "CASE " + " ".join(
        f"WHEN {cond} THEN '{name}'" for name, cond in criteria.items()) + " END"
    _exec(conn, f"""
        UPDATE attendance_records tgt
        SET excluded_from_metrics = true, exclusion_reason = x.reason
        FROM (
            SELECT ar.id, {reason_case} AS reason
            {base_from}
        ) x
        WHERE x.id = tgt.id AND x.reason IS NOT NULL
    """)
    ctx["exclusions_by_reason"] = _pairs(
        conn, "SELECT exclusion_reason, count(*) FROM attendance_records "
              "WHERE excluded_from_metrics GROUP BY 1")
    ctx["countable_records"] = _scalar(conn, f"""
        SELECT count(*) FROM attendance_records ar
        JOIN class_sessions cs ON cs.id = ar.session_id
        WHERE cs.status = 'held' AND ar.status IN {TAKEN_STATUSES_SQL} AND NOT ar.excluded_from_metrics
    """)

    _exec(conn, "ALTER TABLE attendance_records ENABLE TRIGGER USER")
    _exec(conn, "DROP TABLE _bf_sessions")
    _exec(conn, "DROP TABLE _bf_groups")

    ctx["records_by_status_after"] = _pairs(
        conn, "SELECT coalesce(status::text, 'NULL'), count(*) FROM attendance_records GROUP BY 1")
    if ctx["records_by_status_after"] != ctx["records_by_status_before"]:
        raise RuntimeError("Backfill changed attendance statuses; aborting migration: %r" % ctx)
    return ctx


def _swap_uniqueness(conn):
    _exec(conn, "ALTER TABLE attendance_records ADD CONSTRAINT uq_attendance_student_session "
                "UNIQUE (student_id, session_id)")
    _exec(conn, "CREATE UNIQUE INDEX uq_attendance_legacy_day ON attendance_records "
                "(student_id, subject_id, date) WHERE session_id IS NULL")
    _exec(conn, "ALTER TABLE attendance_records DROP CONSTRAINT unique_attendance_student_subject_date")


def _insert_policy_setting(conn):
    """Insert attendance_policy defaults (DOMAIN_RULES 2, 13.1, 13.9) unless the key exists."""
    result = _exec(conn, f"""
        INSERT INTO system_settings (key, value, category, description, data_type, is_active)
        VALUES (
            'attendance_policy',
            jsonb_build_object(
                'checkin_opens_minutes_before', 10,
                'late_after_minutes', 10,
                'checkin_closes_after_minutes', 20,
                'finalize_grace_minutes', 15,
                'teacher_edit_window_days', 7,
                'late_counts_as_attended', true,
                'auto_absent_lookback_days', 7,
                'exam_days_suspend_classes', true,
                'tracking_start_date', to_char((now() AT TIME ZONE '{APP_TZ}')::date, 'YYYY-MM-DD')
            ),
            'attendance',
            'Attendance session policy: check-in window, lateness, finalization grace, teacher edit window, '
            'auto-absent lookback, exam suspension and the date session tracking started.',
            'json',
            true
        )
        ON CONFLICT (key) DO NOTHING
    """)
    return result.rowcount == 1


# ------------------------------------------------------------------------- downgrade

def downgrade():
    conn = op.get_bind()

    excused = _scalar(conn, "SELECT count(*) FROM attendance_records WHERE status::text = 'excused'")
    if excused:
        raise RuntimeError(
            f"Cannot downgrade o20261018_class_sessions: {excused} attendance_records have status "
            "'excused', which the previous application version does not understand. Resolve them first.")

    duplicates = _scalar(conn, """
        SELECT count(*) FROM (
            SELECT 1 FROM attendance_records
            GROUP BY student_id, subject_id, date HAVING count(*) > 1
        ) d
    """)
    if duplicates:
        raise RuntimeError(
            f"Cannot downgrade o20261018_class_sessions: {duplicates} (student_id, subject_id, date) groups "
            "have more than one attendance record (several sessions of one subject on one day), so "
            "UNIQUE(student_id, subject_id, date) cannot be restored. Resolve them first.")

    # Uniqueness back to one record per student/subject/day.
    _exec(conn, "ALTER TABLE attendance_records ADD CONSTRAINT unique_attendance_student_subject_date "
                "UNIQUE (student_id, subject_id, date)")
    _exec(conn, "DROP INDEX IF EXISTS uq_attendance_legacy_day")
    _exec(conn, "ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS uq_attendance_student_session")

    # Original FK actions (student CASCADE, subject NO ACTION).
    _replace_fk(conn, "attendance_records", "student_id", "students",
                "attendance_records_student_id_fkey", "CASCADE")
    _replace_fk(conn, "attendance_records", "subject_id", "subjects",
                "fk_attendance_subject", None)

    _exec(conn, "DROP INDEX IF EXISTS idx_attendance_session_id")
    _exec(conn, """
        ALTER TABLE attendance_records
            DROP CONSTRAINT IF EXISTS ck_attendance_source,
            DROP CONSTRAINT IF EXISTS fk_attendance_session,
            DROP COLUMN IF EXISTS exclusion_reason,
            DROP COLUMN IF EXISTS excluded_from_metrics,
            DROP COLUMN IF EXISTS source,
            DROP COLUMN IF EXISTS session_id
    """)

    _exec(conn, "DROP TABLE IF EXISTS attendance_audit_log")
    _exec(conn, "DROP TABLE IF EXISTS job_runs")
    _exec(conn, "DROP TABLE IF EXISTS class_sessions")

    _exec(conn, "ALTER TABLE class_schedules DROP CONSTRAINT IF EXISTS ck_class_schedule_time_order")
    _exec(conn, "ALTER TABLE students DROP COLUMN IF EXISTS cohort_since, DROP COLUMN IF EXISTS enrolled_on")
    # attendance_status keeps the 'excused' label (PostgreSQL cannot drop enum values).
