"use client";

import { useState } from "react";

export default function SetupGuide({ sql }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(sql); setMessage("복사했어요. Supabase의 SQL Editor에 붙여넣으세요."); }
    catch { setMessage("아래 글 전체를 선택해서 직접 복사해주세요."); }
  }
  return <><button className="primary-button" onClick={copy}>설정 내용 전체 복사</button><p role="status">{message}</p><details><summary>복사할 내용 보기</summary><pre><code>{sql}</code></pre></details></>;
}
