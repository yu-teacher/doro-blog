export type CodeTab = 'curl' | 'python' | 'node' | 'github';

export const CODE_TABS: readonly CodeTab[] = ['curl', 'python', 'node', 'github'];

/** API 호출 예제 코드. 문서 화면에서 복사해 쓰도록 엔드포인트만 바꿔 끼운다. */
export function buildCodeSnippets(apiEndpoint: string): Record<CodeTab, string> {
  return {
    curl: `curl -X POST ${apiEndpoint} \\
  -H "X-API-Key: doro_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "DORO 자동화 포스트 제목",
    "slug": "automated-post-slug",
    "content": "### DORO Blog API 게시물\\n\\n이 글은 API 키를 통해 자동 게시되었습니다.",
    "summary": "헤드리스 API 키를 사용한 자동 발행 포스트",
    "status": "PUBLISHED",
    "tags": ["Automation", "API", "Doro"]
  }'`,

    python: `import requests

API_KEY = "doro_live_your_api_key_here"
API_URL = "${apiEndpoint}"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

payload = {
    "title": "Python 스크립트로 자동 작성된 포스트",
    "slug": "python-automated-post",
    "content": "## 데이터 리포트\\n\\nPython 스크립트가 매일 정기적으로 요약된 데이터를 게시합니다.",
    "summary": "Python 자동화 스크립트 게시물",
    "status": "PUBLISHED",
    "tags": ["Python", "Automation", "Bot"]
}

response = requests.post(API_URL, json=payload, headers=headers)
print("Status Code:", response.status_code)
print("Response:", response.json())`,

    node: `// Node.js (v18+ native fetch or Axios)
const API_KEY = "doro_live_your_api_key_here";
const API_URL = "${apiEndpoint}";

async function publishPost() {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Node.js CI 파이프라인 자동 게시",
      slug: "nodejs-ci-automated-post",
      content: "## 배포 완료 공지\\n\\n신규 빌드가 성공적으로 배포되어 블로그에 자동 공지합니다.",
      summary: "Node.js 배포 파이프라인 자동 공지글",
      status: "PUBLISHED",
      tags: ["NodeJS", "CI/CD", "Automation"],
    }),
  });

  const result = await response.json();
  console.log("Result:", result);
}

publishPost();`,

    github: `name: Publish Release Notes to DORO Blog

on:
  release:
    types: [published]

jobs:
  publish-post:
    runs-on: ubuntu-latest
    steps:
      - name: Send Post to DORO Blog
        run: |
          curl -X POST ${apiEndpoint} \\
            -H "X-API-Key: \${{ secrets.DORO_BLOG_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "title": "새 버전 \${{ github.event.release.tag_name }} 출시 노트",
              "slug": "release-\${{ github.event.release.tag_name }}",
              "content": "\${{ github.event.release.body }}",
              "summary": "새 버전 \${{ github.event.release.tag_name }}가 배포되었습니다.",
              "status": "PUBLISHED",
              "tags": ["Release", "Changelog"]
            }'`,
  };
}
