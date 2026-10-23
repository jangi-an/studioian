# Studio Ian와 하루한칸

이 저장소에는 서로 다른 두 웹사이트가 있습니다.

| 위치 | 사이트 | Vercel의 Root Directory |
| --- | --- | --- |
| 저장소 최상위 | 기존 Studio Ian 사이트 | `.` (기존 설정 유지) |
| [apps/checklist](apps/checklist) | 하루한칸 할 일 앱 | `apps/checklist` |

기존 사이트의 소스와 설정은 그대로 유지합니다. 하루한칸은 Vercel에서 **새 프로젝트**를 만들어 같은 저장소를 가져온 뒤, **Root Directory를 `apps/checklist`**로 선택해 별도 주소로 배포하세요. 기존 Vercel 프로젝트의 Root Directory는 변경하지 마세요.

하루한칸의 실행 방법과 Supabase 설정은 [앱 안내](apps/checklist/README.md)에 있습니다.
