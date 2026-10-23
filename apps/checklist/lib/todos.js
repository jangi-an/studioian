export const GUEST_STORAGE_KEY = "haru-todos-v1";
export const TABLE_NAME = "daily_todos";

export const PRIORITIES = {
  1: { label: "높음", description: "먼저 할 일" },
  2: { label: "보통", description: "차근차근 할 일" },
  3: { label: "낮음", description: "여유 있게 할 일" },
};

export function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function sortTodos(todos) {
  return [...todos].sort((a, b) => Number(a.completed) - Number(b.completed) || a.priority - b.priority || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function readGuestTodos(serialized) {
  if (!serialized) return [];
  const value = JSON.parse(serialized);
  if (!Array.isArray(value)) throw new Error("Invalid saved list");
  return value.filter((item) => item && typeof item.id === "string" && typeof item.title === "string" && item.title.trim().length > 0 && item.title.length <= 200 && typeof item.completed === "boolean" && [1, 2, 3].includes(item.priority) && /^\d{4}-\d{2}-\d{2}$/.test(item.task_date) && typeof item.created_at === "string");
}

export function friendlyError(error) {
  const message = String(error?.message || "").toLowerCase();
  if (error?.code === "PGRST205" || error?.code === "42P01") return "온라인 저장 공간이 아직 준비되지 않았어요. Supabase의 할 일 목록 설정을 먼저 마쳐주세요.";
  if (message.includes("invalid login credentials")) return "이메일 또는 비밀번호를 다시 확인해주세요.";
  if (message.includes("email not confirmed")) return "가입 확인 메일의 링크를 먼저 눌러주세요.";
  if (message.includes("already registered")) return "이미 가입한 이메일이에요. 로그인을 선택해주세요.";
  if (message.includes("rate limit") || error?.status === 429) return "요청이 많아 잠시 쉬고 있어요. 잠시 뒤 다시 시도해주세요.";
  if (message.includes("password")) return "비밀번호는 영문과 숫자를 섞어 8자 이상으로 입력해주세요.";
  if (message.includes("signup") && message.includes("disabled")) return "현재 새 계정을 만들 수 없어요. Supabase의 이메일 가입 설정을 확인해주세요.";
  return "연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.";
}
