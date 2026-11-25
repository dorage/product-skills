// 리포 주소의 마지막 이름에서 .git 을 뗀다 (요구사항 2 「리포 이름」)
export function repoName(url: string): string {
  const trimmed = url.trim().replace(/[/\\]+$/, "");
  const last = trimmed.split(/[/\\:]/).pop() ?? "";
  return last.replace(/\.git$/, "");
}
