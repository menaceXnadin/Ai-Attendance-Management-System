# Face verification

This document is the spec for face enrolment, face check-in, liveness and proof of presence. It was written for the 2026-10 face-verification redesign. Attendance rules (windows, statuses, sessions) stay in [domain-rules.md](domain-rules.md); this file covers only the biometric and anti-fraud layer in front of `student_self_checkin`.

## 1. Principles
- **1:1 verification.** A check-in compares the captured face with the logged-in student's own templates only. 1:N search is used only for the duplicate check at enrolment and the staff `live-recognition` tool.
- **The server decides.** The browser (MediaPipe) only guides framing and the head-turn prompt. Every threshold, liveness verdict and code check runs on the server.
- **Layers:**
  - **Quality gate:** reject unusable frames before matching.
  - **Identity:** cosine similarity against the student's templates.
  - **Liveness:** passive anti-spoofing (MiniFASNet) plus an active random head turn.
  - **Proof of presence:** a rotating session code shown in the classroom.
  - **Rate limit and audit:** every attempt is logged and repeated failures lock check-in temporarily.
- **No face images are stored.** Only embeddings (templates) and numeric measurements are kept.
- **Students never see similarity scores on failure.** The legacy `confidence_score` field is `0.0` unless the result is a match.

## 2. Models
| Purpose | Model | Licence | Where |
|---|---|---|---|
| Detection, 5 landmarks | InsightFace `buffalo_l` SCRFD-10G (`det_10g.onnx`) | Non-commercial research | `~/.insightface/models/buffalo_l` (auto-download) |
| Recognition, 512-d embedding | InsightFace `buffalo_l` ArcFace R50 WebFace600K (`w600k_r50.onnx`) | Non-commercial research | same |
| Passive anti-spoofing | Minivision Silent-Face MiniFASNetV2 (scale 2.7) + MiniFASNetV1SE (scale 4.0), 80×80, converted to ONNX | Apache-2.0 | `backend/models/anti_spoof/` (committed, with `LICENSE` and `NOTICE`) |

- `FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"])`. The landmark and gender/age models are **not** loaded.
- `det_size` comes from `settings.insightface_det_size` (default 640). Webcam selfies work well at 320–480, which is faster.
- The model identifier stored with every template is `insightface/buffalo_l` (`insightface_service.model_id`). Templates from another model can't be compared; changing the model requires re-enrolment.
- **Anti-spoof preprocessing** (must match the original Silent-Face code):
  - Convert the SCRFD bbox `[x1,y1,x2,y2]` to `[x, y, w, h]`.
  - Expand it around its centre by the model's scale, clamped to the image as in Silent-Face `CropImage._get_new_box`.
  - Crop and resize to 80×80. The input is **BGR, float32, not divided by 255**, in NCHW layout.
  - Apply softmax to the output. Class 1 is "real".
  - The score is the mean "real" probability over both models, in `[0, 1]`.
  - `liveness_available` is true only when **both** model files load (`settings.antispoof_model_dir`, empty = `backend/models/anti_spoof`).
- **Performance** (16-core CPU, 640×480 frame with one face, liveness included): about 150 ms at `det_size` 640 and 105 ms at 320. The old five-model engine took about 350 ms per frame, and 1.8 s on a six-face photo, where the new engine takes 160 ms because it embeds only the largest face. The engine re-creates the two InsightFace ONNX sessions with intra-op spinning disabled; with the default spinning, detection and recognition starve each other's thread pools, which made each frame about 2.5× slower.

## 3. Engine API (`app/services/insightface_service.py`)
The module exposes the singleton `insightface_service`. Tests replace the whole module with `tests/support/fake_face.py`, so **all model access, liveness included, goes through this singleton**. No other module imports `insightface`, `onnxruntime` or `face_liveness` directly.

```python
insightface_service.model_id: str                 # "insightface/buffalo_l"
insightface_service.liveness_available: bool      # anti-spoof ONNX models loaded
insightface_service.tolerance: float              # legacy; = settings.face_recognition_tolerance

insightface_service.process_frames(frames_b64: list[str], *, with_liveness: bool) -> list[dict]   # sync, CPU
await insightface_service.aprocess_frames(frames_b64, *, with_liveness)                          # same, in a worker thread
```

`aprocess_frames` runs `process_frames` through `anyio.to_thread.run_sync` behind a module-level `CapacityLimiter(settings.face_max_concurrency)` (default 2). Routes must use the async variant; they must never call model code on the event loop.

Each frame result is a dict:

| Key | Type | Meaning |
|---|---|---|
| `index` | int | Position in the input list |
| `ok` | bool | A usable face was found (`error is None`) |
| `error` | str \| None | `invalid_image` (decode failed / too large), `no_face` |
| `faces_detected` | int | Faces with `det_score >= 0.5` |
| `secondary_face_ratio` | float | Area of the 2nd-largest face / largest face (0.0 if one face) |
| `image_shape` | [h, w] | After decode and downscale |
| `face` | dict \| None | The largest face (below) |
| `liveness` | float \| None | Mean "real" probability; `None` if not requested, no face, or models unavailable |

`face` dict:

| Key | Type | Meaning |
|---|---|---|
| `bbox` | [x1,y1,x2,y2] | Pixels |
| `det_score` | float | SCRFD confidence (also copied to `confidence` for legacy callers) |
| `kps` | 5×[x,y] | Left eye (image-left), right eye, nose, left mouth, right mouth |
| `embedding` | list[float] (512) | L2-normalised |
| `embedding_norm` | float | Norm of the raw ArcFace embedding before normalisation (diagnostic only) |
| `width`, `height`, `area` | float | bbox size |
| `area_ratio` | float | bbox area / image area |
| `yaw` | float | Head-turn proxy: `(nose.x − eye_mid.x) / eye_distance` on the **unmirrored** image. `> 0` means the subject turned to **their left**; `< 0` to their right; ≈0 frontal |
| `sharpness` | float | Variance of the Laplacian of the grey face crop resized to 112×112 |
| `brightness` | float | Mean grey level of the face crop (0–255) |

Pure helpers live in **`app/services/face_math.py`** (no model, importable everywhere, re-exported by the engine and the test fake): `cosine_similarity`, `best_similarity(templates, emb)` (max cosine, `0.0` for none), `best_match_index`, `composite_embedding(embs)` (L2-normalised mean), `yaw_from_kps(kps)`, `classify_pose(yaw, frontal_max_yaw=, turn_min_yaw=)`, `antispoof_crop_box(img_w, img_h, bbox_xyxy, scale)` and `quality_issues(face, …)` (the quality-gate codes).

**Module map:**

| Module | Role |
|---|---|
| `services/insightface_service.py` | Engine singleton: models, `process_frames` / `aprocess_frames`, legacy helpers |
| `services/face_liveness.py` | MiniFASNet ONNX runner, used only by the engine |
| `services/face_math.py` | Pure helpers (above) |
| `services/face_policy.py` | `FacePolicy`, `get_face_policy`, `build_face_policy`, `validation_errors` |
| `services/face_challenges.py` | `create_challenge`, `challenge_payload`, `consume_challenge` |
| `services/face_attempts.py` | `record_attempt`, `lockout_status`, `FAILURE_OUTCOMES` |
| `services/face_store.py` | `load_templates`, `gallery`, `template_summary`, `clear_face_data`, `add_enrollment_event`, `face_fields` |
| `services/face_enrollment.py` | Enrolment, deletion and admin reset (§8) |
| `services/face_verification.py` | Check-in orchestration (§7) |
| `services/presence_code.py` | Rotating session codes (§9) |
| `api/routes/face_recognition.py` | Check-in, challenge, policy, verify and diagnostics endpoints |
| `api/routes/face_enrollment.py` | Enrolment endpoints (same `/face-recognition` prefix) |

Legacy methods kept for compatibility: `decode_base64_image`, `extract_face_features`, `detect_faces`, `compare_embeddings` (returns `(is_match, best_similarity_pct, idx)` with `self.tolerance`), `get_model_info`. Removed: the development mock mode, glasses detection, `process_face_registration`, `process_multi_image_face_registration`, `process_attendance_image`, `validate_face_image`.

Input limits (in `app/core/face_constants.py`): a frame larger than `MAX_FRAME_BASE64_CHARS` (3,000,000), or one that decodes to more than `MAX_DECODE_PIXELS` (40 megapixels) → `invalid_image`; images are downscaled to `MAX_DECODE_DIMENSION` (1280) on the longest side. A `data:` URL prefix is accepted.

`insightface_service.analyze_image(image_bgr, *, with_liveness)` returns the same per-frame dict for an image that is already decoded. Only `scripts/calibrate_face_threshold.py` uses it. It isn't in the test fake, so routes and services must not call it.

## 4. Policy (`system_settings` key `face_verification`)
Loaded by `app/services/face_policy.py` → frozen `FacePolicy` (`get_face_policy(db)`, pure `build_face_policy(raw)` that falls back to the default for any missing or invalid value). `PUT /api/system-settings/settings/face_verification` merges partial updates (like `attendance_policy`) and is upsertable.

| Key | Default | Meaning |
|---|---|---|
| `match_threshold` | 0.45 | Min cosine similarity of the best frontal frame against the student's templates |
| `consistency_threshold` | 0.30 | Min similarity of **every** other frame in the burst (same person throughout) |
| `duplicate_threshold` | 0.45 | Enrolment is blocked if the new composite matches another student at or above this |
| `require_liveness` | true | Passive anti-spoof check |
| `antispoof_threshold` | 0.70 | Min mean "real" probability |
| `require_head_turn` | true | Active challenge required (check-in and enrolment) |
| `head_turn_min_yaw` | 0.18 | Min `|yaw|` (with the right sign) for the turned frame |
| `frontal_max_yaw` | 0.12 | Max `|yaw|` for a frame to count as frontal |
| `challenge_ttl_seconds` | 90 | Challenge lifetime |
| `frames_min` / `frames_max` | 3 / 8 | Burst size when a head turn is required (1 / 8 otherwise) |
| `require_presence_code` | true | Check-in needs the current session code |
| `presence_code_period_seconds` | 30 | Code rotation period |
| `max_failed_attempts` | 5 | Failures allowed per window before lock-out |
| `failed_attempt_window_minutes` | 10 | Rolling window for the lock-out |
| `min_detection_score` | 0.60 | Check-in frames |
| `enrolment_min_detection_score` | 0.70 | Enrolment frames |
| `min_face_size_px` | 80 | Min bbox width and height |
| `min_sharpness` | 20.0 | Laplacian variance on the 112×112 crop |
| `min_brightness` / `max_brightness` | 40 / 220 | Face-crop mean grey level |
| `enrolment_min_images` | 3 | Valid frames needed to enrol |

`FacePolicy.public_dict()` (served by `GET /api/face-recognition/policy` to any logged-in user) exposes only `require_liveness`, `require_head_turn`, `require_presence_code`, `frames_min`, `frames_max`, `challenge_ttl_seconds`, `presence_code_period_seconds`, `enrolment_min_images`.

The thresholds are defaults, not calibrated values. `backend/scripts/calibrate_face_threshold.py` computes genuine and impostor score distributions from a labelled folder (`<person>/<image>.jpg`) and prints FAR/FRR per threshold with a recommendation for a target FAR.

## 5. Data model (migration `p20261018_face_verification`)
- **`students` new columns:**
  - `face_enrollment_status` varchar(16) NN default `'none'`, CHECK in (`none`, `enrolled`, `reset`, `deleted`);
  - `face_registered_at` timestamptz;
  - `face_model` varchar(64);
  - `face_consent_at` timestamptz.

  The migration sets `enrolled` and `face_model='insightface/buffalo_l'` where `face_encoding IS NOT NULL`. `students.face_encoding` remains the composite template (L2-normalised mean of the enrolment embeddings).
- **`face_templates`:**
  - `id`, `student_id` → students (CASCADE);
  - `model` varchar(64) NN;
  - `pose` varchar(16) NN (`front`, `left`, `right`);
  - `embedding` JSONB NN (512 floats);
  - `quality` JSONB (`det_score`, `sharpness`, `brightness`, `yaw`, `area_ratio`);
  - `created_at`.
  - Index `(student_id)`.
- **`face_challenges`:**
  - `id` varchar(32) PK (uuid4 hex), `student_id` → students (CASCADE);
  - `purpose` varchar(16) (`checkin` | `enrolment`), `action` varchar(24) (`turn_left` | `turn_right` | `front_left_right`);
  - `session_id` → class_sessions (SET NULL);
  - `created_at`, `expires_at` NN, `used_at`.
  - Index `(student_id, created_at)`.
- **`face_verification_attempts`:**
  - `id`, `student_id` → students (CASCADE), `session_id` → class_sessions (SET NULL), `challenge_id` varchar(32);
  - `purpose` varchar(16) (`checkin` | `verify` | `enrolment`), `outcome` varchar(32) NN, `counts_as_failure` bool NN;
  - `similarity` numeric(6,4), `liveness_score` numeric(6,4);
  - `details` JSONB (frame count, yaw values, quality metrics, quality issues), `ip_address` varchar(45);
  - `created_at` NN default now().
  - Indexes `(student_id, created_at)` and `(session_id)`.
- **`face_enrollment_events`:**
  - `id`, `student_id` → students (CASCADE);
  - `action` varchar(24) (`enrolled`, `reset`, `deleted`, `duplicate_blocked`, `spoof_blocked`);
  - `actor_user_id` → users (SET NULL), `reason` text, `details` JSONB, `created_at`.

Models live in `app/models/face.py` (`FaceTemplate`, `FaceChallenge`, `FaceVerificationAttempt`, `FaceEnrollmentEvent`) and are exported from `app.models`.

## 6. Challenges
`POST /api/face-recognition/challenge` (student). Body: `{purpose: "checkin" | "enrolment", session_id?, subject_id?, schedule_id?}`.
- `checkin`: `action` is `turn_left` or `turn_right`, chosen with `secrets`.
- `enrolment`: `action` is `front_left_right`.
- Response: `{challenge_id, purpose, action, expires_at, ttl_seconds, frames_min, frames_max, requires_head_turn, requires_liveness, requires_presence_code, instructions}`.
- Rules:
  - A challenge belongs to one student and is **single use**: `used_at` is set when a check-in or enrolment request first references it, whatever the outcome.
  - Expired, used, unknown or another student's challenge → `challenge_invalid`.
  - Creating a challenge deletes that student's challenges older than one day.
  - When `require_head_turn` is false, the endpoint still works (the client may skip it).

## 7. Check-in (`POST /api/face-recognition/mark-attendance`)
Request (all optional except one of `frames` / `image_data`):
```json
{ "frames": ["<b64>", ...], "image_data": "<b64>", "challenge_id": "…", "presence_code": "123456",
  "session_id": 1, "schedule_id": 2, "subject_id": 3 }
```
`image_data` (legacy) is treated as `frames=[image_data]`. Business outcomes are **HTTP 200** with `{success:false, code, message}`, as before. The response adds `quality_issues: string[] | null` and `retry_after_seconds: int | null` to the existing fields.

Order of checks (the first failure wins):
1. **Lock-out:** count `counts_as_failure` attempts in the last `failed_attempt_window_minutes`. If the count is ≥ `max_failed_attempts` → `too_many_attempts` (with `retry_after_seconds` until the oldest counted failure leaves the window). Logged, but doesn't count as a failure.
2. **`no_registered_face`** if the student has no composite template.
3. **Session:** `find_checkin_session` (existing rules: `between_terms`, `no_session_today`, `not_enrolled`, `session_cancelled`, `window_closed`).
4. **Presence code**, if required: missing → `presence_code_required`; wrong → `presence_code_invalid` (**failure**).
5. **Challenge**, if a head turn is required: missing → `challenge_required`; invalid → `challenge_invalid` (**failure**). It's consumed now.
6. **Frames:** fewer than `frames_min` or more than `frames_max` → `invalid_frames`. Run `aprocess_frames(with_liveness=require_liveness)`.
7. **Quality**, per frame:
   - `invalid_image` or `no_face` on every frame → `no_face_detected`;
   - any frame with `faces_detected > 1` and `secondary_face_ratio > 0.25` → `multiple_faces`;
   - the frontal frames used for identity must pass `min_detection_score`, `min_face_size_px`, sharpness and brightness. Otherwise → `low_quality` with `quality_issues` ⊆ {`too_dark`, `too_bright`, `too_blurry`, `too_small`, `low_confidence`, `not_frontal`}.
   - Frames without a face are ignored if enough usable frames remain (`frames_min`).
8. **Identity:**
   - Templates = the composite plus all `face_templates` rows for the current `model_id`.
   - The best frontal frame (`|yaw| ≤ frontal_max_yaw`; if a head turn isn't required, the most frontal frame) must reach `match_threshold`.
   - Every other face frame must reach `consistency_threshold`.
   - Otherwise → `face_mismatch` (**failure**).
9. **Head turn**, if required: at least one face frame with `yaw ≥ head_turn_min_yaw` for `turn_left` (`≤ −head_turn_min_yaw` for `turn_right`). Otherwise → `liveness_failed` (**failure**).
10. **Passive liveness**, if required:
    - If `liveness_available` is false → `liveness_unavailable` (not a failure; an admin must install the models or switch it off).
    - The mean `liveness` of up to two best frontal frames must reach `antispoof_threshold`. Otherwise → `spoof_suspected` (**failure**).
11. **Record:** `student_self_checkin` (existing rules, `already_recorded`). `confidence` = best similarity × 100.

Every request writes one `face_verification_attempts` row: `outcome` = `success` or the code, similarity and liveness when known, and `details`. The row is committed even when the request is rejected (write it after any rollback). Failure codes: `face_mismatch`, `liveness_failed`, `spoof_suspected`, `presence_code_invalid`, `challenge_invalid`.

### 7.1 Implementation decisions (check-in)
- Consistency (step 8): each non-frontal face frame is scored against the templates **and** the best frontal frame (max); a different person still fails.
- If fewer than `frames_min` usable frames remain after dropping faceless ones → `no_face_detected`.
- Frontal frames that fail quality are skipped; `low_quality` only when no frontal frame passes (`quality_issues` is the union). With a head turn required and no frontal frame → `low_quality` with `["not_frontal"]`.
- Liveness available but no score on the chosen frames → `liveness_unavailable`.
- A session created on demand at step 3 is committed so the attempt can reference it even when a later step rejects.
- A challenge's own `session_id` is not required to match the check-in session; the presence code binds the request to the session.
- Endpoints that run models answer **503 `face_engine_unavailable`** if the engine failed to load (`require_face_engine` in `api/dependencies.py`).

`POST /face-recognition/verify-identity` (legacy, not used by the new UI):
- runs steps 1, 2, 6, 7 and 8;
- logs an attempt with purpose `verify` (a mismatch counts as a failure);
- never returns a score on a mismatch.

## 8. Enrolment
Statuses:
- `none`: never enrolled. Can enrol.
- `enrolled`: has templates. Can't enrol (`already_enrolled`, 409).
- `reset`: an admin reset the face. Can enrol.
- `deleted`: the student deleted their face data. Can't enrol until an admin resets it (`enrolment_locked`, 409).

Endpoints:
- **`GET /api/face-recognition/enrollment`** (student): `{status, can_enroll, registered_at, model, template_count, consent_at, message}`.
- **`POST /api/face-recognition/register-face-multi`** (student). Body: `{images: [b64...], consent: true, challenge_id?}`.

  **`POST /api/face-recognition/register-face`** accepts the same fields, plus the legacy `image_data` (a string or list, used as `images`).

  Steps:
  1. Check the status (`already_enrolled` / `enrolment_locked`).
  2. `consent` must be true → otherwise `consent_required` (400).
  3. If a head turn is required: the challenge must be a valid `enrolment` challenge → otherwise `challenge_required` / `challenge_invalid` (400). It's consumed.
  4. Need between `enrolment_min_images` and 8 images → otherwise `invalid_frames` (400).
  5. Run `aprocess_frames`. A frame is valid when it has exactly one face (`secondary_face_ratio ≤ 0.25`), `det_score ≥ enrolment_min_detection_score`, and passes size, sharpness and brightness. Fewer than `enrolment_min_images` valid → `low_quality` (422, `details.image_results`).
  6. Pose: classify each valid frame with `frontal_max_yaw` / `head_turn_min_yaw` as front, left or right. If a head turn is required, at least one of each is needed → otherwise `pose_coverage` (422). Otherwise at least one front is needed.
  7. Liveness, if required: `liveness_unavailable` (503), or the mean liveness of the front frames must reach `antispoof_threshold` → otherwise `spoof_suspected` (422) and a `spoof_blocked` event.
  8. Composite = `composite_embedding(valid embeddings)`.
  9. Duplicate check: the best similarity of the composite against every other student's composite and templates. If ≥ `duplicate_threshold` → `duplicate_face` (409, message *"This face is already registered to another account. Contact an administrator."*, the other student isn't revealed) and a `duplicate_blocked` event naming the other student.
  10. Save: replace `face_templates` (one row per valid frame, with pose and quality), set `face_encoding`, `face_enrollment_status='enrolled'`, `face_registered_at`, `face_model`, `face_consent_at`, write an `enrolled` event, and log an attempt with purpose `enrolment`.

  Response (compatible): `{success: true, message, details: {images_processed, valid_images, poses: {front, left, right}, template_count, model, image_results}}`. Errors use the standard `{"detail": {code, message, details}}` body.
- **`DELETE /api/face-recognition/my-face`** (student): deletes the templates, sets `face_encoding = NULL` and the status to `deleted`, and writes a `deleted` event. Response `{success, message}`.
- **`POST /api/students/{student_id}/face/reset`** (admin). Body `{reason}` (required, at least 3 characters). Deletes the templates, sets `face_encoding = NULL` and the status to `reset`, and writes a `reset` event with the actor.
- **`GET /api/students/{student_id}/face`** (admin): the status fields, template count and pose list, plus the last 50 events (with actor name).

Student payloads (`GET /students`, `GET /students/{id}`): `face_encoding` is **always `null`**, so embeddings never leave the server. They add `face_registered` (bool), `face_registered_at` and `face_enrollment_status`. Clients use `face_registered`.

### 8.1 Implementation decisions (enrolment)
- A student who has a composite template but status `none` or `reset` counts as `enrolled`, so a template can't be overwritten without an admin reset.
- The challenge is consumed at step 3; rejections at steps 1–2 (status, consent) leave it unused. A rejected enrolment rolls back its work but still commits the challenge use, the `spoof_blocked` / `duplicate_blocked` event and an attempt row (`purpose='enrolment'`, never counted as a failure).
- `consent: null` returns 400 `consent_required` (not a schema error).
- A valid frame whose yaw falls between `frontal_max_yaw` and `head_turn_min_yaw` is still stored as a template (labelled with the side it leans to) but doesn't count towards pose coverage; its `image_results.pose` is `null`.
- Liveness with no front-frame scores returns `liveness_unavailable` (503).
- `DELETE /my-face` is idempotent and never locks out a student who had no face data.
- The enrolment attempt's `similarity` stores the best duplicate-check score (staff only). Admin reset works from any status; a short reason gives 400 `reason_required`.

## 9. Proof of presence
`app/services/presence_code.py` (pure):
- **Secret:** `HMAC-SHA256(settings.secret_key, "attendai-presence:{session_id}")`.
- **Code:** a TOTP-style 6-digit code. HMAC-SHA256 over the 8-byte big-endian step counter `floor(unix_ts / period)`, RFC 4226 dynamic truncation, zero-padded.
- **`verify_code(session_id, code, now, period)`** accepts the current and the previous step (the code stays valid for up to two periods) and compares in constant time. Non-digit input → invalid.
- **`GET /api/attendance/sessions/{session_id}/presence-code`** (admin, or the teacher who owns the session per `actor_owns_session`):
  - Other teachers → 403 `not_session_teacher`. A session that isn't today → 409 `not_today`. Cancelled → 409 `session_cancelled`.
  - Response: `{session_id, code, digits, period_seconds, expires_in_seconds, server_time, required, checkin_path, window: {opens_at, closes_at, state}, subject_name, start_time, end_time}`.
  - `checkin_path` is `/student/attendance/mark?session=<id>&code=<code>`. The UI builds the QR from `window.location.origin + checkin_path` and refreshes when `expires_in_seconds` reaches 0.
- **`GET /api/attendance/sessions/{session_id}/face-attempts`** (same guard): `{session_id, attempts: [{id, student_id, student_name, roll_number, outcome, counts_as_failure, similarity, liveness_score, created_at}], summary: {total, successes, failures, by_outcome}}`, newest first, at most 200.

## 10. Frontend
- **Check-in** (`components/FaceRecognition.tsx`):
  1. Get the policy and a challenge.
  2. Show the mirrored preview with a prompt ("Look at the camera" → "Turn your head left/right").
  3. Capture a burst of `frames_min`–`frames_max` **unmirrored** JPEG frames (longest side ≤ 640, quality 0.85) across the prompt.
  4. Send one `mark-attendance` call with `frames`, `challenge_id` and `presence_code`.

  The presence code comes from the `?code=` URL parameter (a QR scan) or a 6-digit input. Every rejection code has a friendly message. `too_many_attempts` shows `retry_after_seconds`.
- **Enrolment** (`components/FaceRegistration.tsx`, `pages/StudentFaceRegistrationPage.tsx`):
  - Consent checkbox, a guided front → left → right capture, and one call with all images and the challenge.
  - The page shows the enrolment status, a locked state ("Ask an administrator to reset your face registration") and "Delete my face data".
- **Staff:**
  - "Show check-in code" opens a full-screen dialog with a QR code (`qrcode.react`) and large digits that refresh automatically, on the teacher register and the admin session register.
  - A "Face check-in attempts" list per session.
  - "Reset face" (with a reason) and a face status badge on the admin Students page.
  - A "Face verification" settings card for the policy.
- Debug and test pages (`/face-integration-test`, `/face-testing`, `/face-registration-demo`, `/face-registration-debug`, `FaceRecognitionTestPage`) and the backend `face_testing` router are removed.
