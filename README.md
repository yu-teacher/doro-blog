# 📝 Doro Blog

[![CI](https://github.com/yu-teacher/doro-blog/actions/workflows/ci.yml/badge.svg)](https://github.com/yu-teacher/doro-blog/actions/workflows/ci.yml)

> **English summary** — A Velog-style technical blogging platform (Spring Boot 4 / React 19) and the first service built on my own identity & authorization platform, **[Doro](https://github.com/yu-teacher/doro)**. Login and permissions are delegated to Doro (JWT verified locally via JWKS, authorization through a Zanzibar-style ReBAC engine), so this service contains **no role-check `if` statements**. I used it as a testbed for production-grade backend practices: lock-free atomic counters, idempotent writes, trigram-indexed search, a defense-in-depth file-upload pipeline (magic-byte detection, an allow-list SVG sanitizer, sandboxing CSP), scoped API keys, and a scripted deploy that snapshots a rollback point before every release. **396 automated tests** (167 backend + 229 frontend).

마크다운으로 글을 쓰고, 시리즈로 묶고, 댓글로 소통하는 **기술 블로그 서비스**입니다.
직접 만든 인증·인가 플랫폼 **[Doro](https://github.com/yu-teacher/doro)** 위에서 동작하는 첫 번째 서비스이고, 로그인·권한 검사 코드는 이 서비스 안에 없습니다.

| | |
|---|---|
| **✍️ 글쓰기** | 마크다운 에디터, 임시저장 자동 저장, 공개/비공개/임시, 썸네일, 태그 |
| **📚 시리즈** | 글을 회차별로 묶는 연재(목차), 순서 일괄 정렬 |
| **💬 소통** | 2단계 대댓글(삭제된 부모는 "삭제된 댓글입니다"), 좋아요, 팔로우, 알림 |
| **🔎 발견** | 트렌딩(일/주/월/년), 태그별 모아보기, 제목·요약·본문 검색 |
| **🧑‍💻 개발자** | 범위가 제한된 API 키로 글·시리즈·태그·업로드를 자동화 |

---

## 🧠 설계에서 신경 쓴 것

### 1. 권한은 코드가 아니라 데이터로 — Doro Guard
글·시리즈·댓글의 모든 권한 판단을 Guard에 위임합니다. 예를 들어 "댓글을 지울 수 있는 사람"은 **댓글 작성자 또는 그 댓글이 달린 글의 작성자**인데, 서비스 코드에는 분기문이 없고 스키마 한 줄로 선언합니다.

```text
type blog_comment {
  relation author: user
  relation post: blog_post
  relation can_delete: author | post#author       # 작성자 ∪ (달린 글의 작성자)
}
```
글·시리즈의 수정/삭제는 컨트롤러에 어노테이션 한 줄로 걸고, 댓글 삭제처럼 서비스 흐름 안에서 판단해야 할 때는 Guard에 직접 묻습니다.

```java
@DoroGuard(namespace = "blog_post", object = "#postId", relation = "editor")   // 글 수정/삭제 컨트롤러
...
guardClient.check("blog_comment", commentId, "can_delete", currentUserId)       // 댓글 삭제 서비스
```
- **DB와 Guard의 일관성**: 튜플을 쓰다 실패하면 예외를 던져 DB 트랜잭션도 롤백하고, 삭제는 커밋이 확정된 뒤에 합니다(`GuardTuples`). 권한 없는 글이나 권한만 남은 글이 생기지 않습니다.
- **스키마 병합 등록**: 기동할 때 Guard의 활성 스키마에서 **없는 블로그 타입만** 덧붙입니다. 다른 서비스의 규칙을 덮어쓰지 않으며, 여러 번 실행해도 결과가 같습니다.
- **회귀 방지**: 소스를 스캔해 코드가 쓰는 모든 튜플·판정이 스키마에 선언돼 있는지 검사하는 테스트가 있습니다.

### 2. 동시성: 읽고-더하고-저장하지 않기
조회수·좋아요·댓글·팔로워 수는 `UPDATE … SET n = n + 1` **한 문장으로 DB가 원자적으로** 올립니다. 좋아요·팔로우는 `INSERT … ON CONFLICT DO NOTHING`의 반영 행 수로 중복 요청을 판단해, 더블클릭에도 숫자가 틀어지지 않습니다. 동시 요청 테스트로 유실이 없음을 검증합니다.

### 3. 검색 성능: 인덱스를 실제로 타게
제목·요약·본문 검색은 PostgreSQL `pg_trgm` GIN 인덱스를 씁니다. `LIKE` 패턴을 애플리케이션에서 만들어 `ESCAPE`와 함께 넘기는 방식으로 바꿔서, 플래너가 세 인덱스를 함께 쓰는 것(`BitmapOr`)을 `EXPLAIN`으로 확인했습니다. 목록 API의 쿼리 수는 테스트로 고정해 N+1 회귀를 막습니다.

### 4. 파일 업로드: 한 겹이 아니라 세 겹
| 방어 | 내용 |
|---|---|
| **내용 기반 판별** | 확장자나 `Content-Type`을 믿지 않고 **매직 바이트**로 형식을 판별. 위장 파일(`.png`로 올린 SVG 등)은 거부 |
| **SVG 허용 목록 정제** | 원본을 저장하지 않고, 허용된 요소·속성만 새 문서로 복사. `script`, `on*` 이벤트, 외부 참조 제거, DOCTYPE 금지(XXE·엔티티 폭탄 차단) |
| **격리된 서빙** | 업로드 파일 응답에 `default-src 'none'; sandbox` CSP를 걸어 직접 열어도 스크립트가 실행되지 않음 |

실제 MinIO를 대상으로 하는 통합 테스트가 있고, 정제기를 일부러 약하게 만들면 실패하는 것도 확인했습니다.

### 5. API 키는 최소 권한으로
키는 `posts`, `series`, `tags`, `uploads` 범위만 호출할 수 있고, 그 밖은 `403`입니다. 오류 응답은 모든 경로(필터 포함)에서 같은 형식(`{ success, code, message, status }`)입니다.

### 6. 배포와 마이그레이션
- **Flyway** 7개 마이그레이션, `ddl-auto: validate`, 서비스 전용 DB(`service_blog`)
- **배포 스크립트**(`scripts/deploy.sh`): 테스트 → 빌드 → **롤백 스냅샷(이전 jar·이미지)** → DB 백업 → 전송 → 재기동 → 헬스체크. 헬스체크가 실패하면 중단하고 복구 방법을 안내하며, 되돌릴 지점은 배포 전에 항상 남깁니다.

---

## 🏗️ 구조

```mermaid
flowchart LR
    U["브라우저"] --> GW["Gateway (nginx)"]
    GW --> W["Blog Web (React)"]
    GW --> B["Blog API (Spring Boot)"]
    B -->|"JWT 로컬 검증 (JWKS)"| I["Doro IAM"]
    B -->|"@DoroGuard → gRPC"| G["Doro Guard"]
    B --- PG[("PostgreSQL<br/>service_blog")]
    B --- M[("MinIO<br/>이미지")]
```

**백엔드** Java 25 · Spring Boot 4.1 · JPA · Flyway · Doro SDK
**프런트엔드** React 19 · Vite · TypeScript · zustand · vitest — 화면 로직은 훅(`usePaginatedList`, `useDraftAutosave` 등)과 순수 함수로 분리해 단위 테스트합니다.

## 🧪 테스트
백엔드 **167개**(단위·통합·동시성·쿼리 수·실제 MinIO) + 프런트엔드 **229개**, ESLint·타입 검사 통과.
`main` 푸시와 PR 마다 GitHub Actions 가 프런트(린트·타입·테스트·빌드)와, 격리된 Postgres·Redis·Guard·MinIO 스택 위에서 백엔드 통합 테스트를 돌립니다(`scripts/ci-test.sh` 로 로컬에서도 동일하게 재현).

## 🚀 실행
```bash
# 백엔드 (DB/MinIO/Doro 가 떠 있어야 합니다)
DB_PASSWORD=... MINIO_SECRET_KEY=... ./gradlew bootRun
./gradlew test                       # 백엔드 테스트

# 프런트엔드
cd web && npm install && npm run dev
```
API 문서는 실행 후 `http://localhost:8082/swagger-ui.html` 에서 볼 수 있습니다.

## 🛠️ 주요 REST API
| | |
|---|---|
| 글 | `POST /api/v1/posts`, `GET /api/v1/posts`(피드), `/search`, `/trending`, `/@{username}/{slug}`, `PUT·DELETE /{id}` |
| 시리즈 | `POST /api/v1/series`, `GET /series/{id}`, `PUT /series/{id}/sort` |
| 댓글·좋아요 | `POST /posts/{id}/comments`(+ `/replies`), `DELETE /comments/{id}`, `POST /posts/{id}/likes` |
| 사용자 | `GET /users/@{username}`, `PUT /users/me`, `POST /users/@{username}/follow` |
| 업로드·태그 | `POST /api/v1/uploads`, `GET /api/v1/tags` |
