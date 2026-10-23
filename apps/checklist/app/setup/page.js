import { readFile } from "node:fs/promises";
import path from "node:path";
import SetupGuide from "@/components/setup-guide";

export const metadata = { title: "온라인 저장 설정 · 하루한칸" };

export default async function SetupPage() {
  const sql = await readFile(path.join(process.cwd(), "supabase/setup.sql"), "utf8");
  return <main className="setup-page"><a className="text-button" href="/">← 메모장으로 돌아가기</a><h1>여러 기기에서 같은 목록 보기</h1><p>프로젝트 주인이 한 번만 해주면 되는 설정이에요. 로그인한 사람마다 자신의 할 일만 볼 수 있는 저장 공간을 만듭니다.</p><h2>1. 저장 공간 만들기</h2><ol><li>아래 <strong>설정 내용 전체 복사</strong> 버튼을 누르세요.</li><li>Supabase에서 프로젝트를 열고 <strong>SQL Editor → New query</strong>를 누르세요.</li><li>복사한 내용을 붙여넣고 <strong>Run</strong>을 누르세요. 기존 할 일은 삭제하지 않습니다.</li></ol><SetupGuide sql={sql} /><h2>2. 이메일 가입 켜기</h2><p>Supabase의 <strong>Authentication → Sign In / Providers → Email</strong>에서 이메일 가입이 켜져 있는지 확인하세요.</p><p><strong>Authentication → URL Configuration</strong>에서 이 앱의 실제 주소를 Site URL로 설정하고, Redirect URLs에 <code>앱주소/auth/callback</code>을 추가하세요. 가입한 브라우저에서 확인 메일의 링크를 여세요.</p><h2>3. 같은 계정으로 로그인하기</h2><p>메모장에서 이메일로 회원가입하고, 확인 메일의 링크를 누르세요. 휴대폰과 컴퓨터에서 같은 이메일로 로그인하면 목록이 함께 보입니다. 목록은 10초마다, 창을 다시 열 때, 새로고침 버튼을 누를 때 갱신됩니다.</p><a className="primary-button" href="/">메모장 열기</a></main>;
}
