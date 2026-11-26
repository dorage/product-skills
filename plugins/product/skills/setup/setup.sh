#!/bin/sh
# npm 이 없는 컴퓨터에서 product CLI 대신 같은 셋업을 한다 (design.md 컴포넌트 setup.sh, U1).
# git 과 sh 만 쓴다. 질문은 부르는 쪽(setup 스킬)이 inspect 결과로 먼저 하고, 답을 인자로 넘긴다.
#
#   setup.sh inspect
#   setup.sh external <리포 주소>...
#   setup.sh internal top|here
#   setup.sh settings-only external|internal
#
# 첫 줄은 상태 한 줄(DONE·ALREADY·STOPPED·COMMIT_FAILED)이고, 그 아래에 정보와 next: 명령을 찍는다.
# 종료 코드는 CLI 와 같다: 0 DONE·ALREADY, 1 잘못 부름, 6 STOPPED, 7 COMMIT_FAILED.

set -u

MSG='chore:product 폴더 추가'
FILES='.product/.gitignore .product-settings'

# U2: 표준 입력이 터미널이 아니면 git 이 비밀번호나 키 암호를 묻지 않고 실패하게 한다
if [ ! -t 0 ]; then
  GIT_TERMINAL_PROMPT=0
  GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -o BatchMode=yes"
  export GIT_TERMINAL_PROMPT GIT_SSH_COMMAND
fi

HERE=$(pwd -P)

# 명령 줄에 그대로 붙여 넣을 수 있게 필요할 때만 작은따옴표로 감싼다 (CLI 의 q 와 같은 규칙)
q() {
  case $1 in
    '' | *[!A-Za-z0-9_@%+=:,./-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}

# 다음 명령을 product 루트에서 치게 한다. 지금 폴더와 다르면 cd 를 앞에 붙인다
in_dir() {
  if [ "$1" = "$HERE" ]; then printf '%s' "$2"; else printf 'cd %s && %s' "$(q "$1")" "$2"; fi
}

last_line() { printf '%s\n' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^$/d' | tail -n 1; }

# 설정 파일의 productDirName 값. 따옴표는 벗기고, 따옴표 없는 값은 뒤의 # 주석을 뗀다. 없거나 값이 비면 빈 글자
name_value() {
  [ -f "$1/.product-settings" ] || return 0
  v=$(sed -n 's/^productDirName:[[:space:]]*//p' "$1/.product-settings" | head -n 1)
  case $v in
    \'*) printf '%s' "$v" | sed "s/^'\([^']*\)'.*/\1/" ;;
    \"*) printf '%s' "$v" | sed 's/^"\([^"]*\)".*/\1/' ;;
    *) printf '%s' "$v" | sed -e 's/^#.*$//' -e 's/[[:space:]]#.*$//' -e 's/[[:space:]]*$//' ;;
  esac
}

# productDirName 이 폴더 이름 하나면 0 (CLI settings.ts 와 같은 규칙). / 나 \ 가 든 경로, . 과 .. 은 안 된다
name_ok() {
  case $1 in
    '' | . | .. | */* | *\\*) return 1 ;;
  esac
  return 0
}

# product 폴더 이름. 설정 파일에 쓸 수 있는 productDirName 이 있으면 그 값, 아니면 .product
product_name() {
  n=$(name_value "$1")
  if [ -n "$n" ] && name_ok "$n"; then printf '%s' "$n"; else printf '.product'; fi
}

# 폴더 하나가 product 루트인지. 설정 파일이 있거나, 없으면 .product/ 가 있어야 한다
is_product_root() { [ -f "$1/.product-settings" ] || [ -d "$1/.product" ]; }

# none | missing | invalid | ok
settings_state() {
  [ -f "$1/.product-settings" ] || { [ -d "$1/.product" ] && echo missing || echo none; return; }
  n=$(name_value "$1")
  if grep -Eq '^mode: (external|internal)[[:space:]]*$' "$1/.product-settings" &&
    grep -Eq '^root: ' "$1/.product-settings" &&
    grep -Eq '^templates:' "$1/.product-settings" &&
    ! grep -Eq "^productDirName:[[:space:]]*(''|\"\")" "$1/.product-settings" &&
    { [ -z "$n" ] || name_ok "$n"; }; then
    echo ok
  else
    echo invalid
  fi
}

settings_mode() { sed -n 's/^mode: *\([a-z]*\).*/\1/p' "$1/.product-settings" | head -n 1; }

# 요구사항 6 「설정 파일 내용」. CLI writeSettings 와 같은 글자
write_settings() { printf 'mode: %s\nroot: .\ntemplates: {}\n' "$2" >"$1/.product-settings"; }

# .product/ 와 .gitignore 3줄. .gitignore 가 이미 있으면 덮어쓰지 않는다
make_product() {
  mkdir -p "$1/.product" || return 1
  [ -e "$1/.product/.gitignore" ] || printf '_humanize/\n_workspace/\n.*.before\n' >"$1/.product/.gitignore"
}

# 지금 폴더보다 위쪽에서 가장 가까운 product 폴더
ancestor() {
  d=$(dirname "$1")
  while :; do
    if is_product_root "$d"; then echo "$d/$(product_name "$d")"; return; fi
    [ "$d" = / ] && return
    d=$(dirname "$d")
  done
}

# 리포 주소의 마지막 이름에서 .git 을 뗀다 (요구사항 2 「리포 이름」)
repo_name() { printf '%s' "$1" | sed -e 's#[/\\]*$##' -e 's#.*[/\\:]##' -e 's#\.git$##'; }

inside_git() { [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; }
git_top() { t=$(git rev-parse --show-toplevel 2>/dev/null) && (cd "$t" && pwd -P); }

# E1 과 깨진 설정 파일. 그 갈래를 탔으면 0
already() {
  case $(settings_state "$1") in
    ok)
      echo ALREADY
      echo "mode: $(settings_mode "$1")"
      echo "productDir: $1/$(product_name "$1")"
      return 0
      ;;
    invalid)
      echo STOPPED
      echo "reason: $1/.product-settings 를 읽을 수 없다"
      echo "next: 설정 파일을 고치거나 지운 뒤 다시 셋업한다"
      exit 6
      ;;
  esac
  return 1
}

# E2: .product/ 만 있을 때 설정 파일만 만든다. 커밋하지 않고 직접 칠 커밋 명령을 보여 준다
settings_only() {
  if ! is_product_root "$1"; then
    echo "$1 에 .product/ 가 없다" >&2
    exit 1
  fi
  already "$1" && return
  write_settings "$1" "$2" || exit 1
  echo DONE
  echo "mode: $2"
  echo "productDir: $1/.product"
  echo "next: $(in_dir "$1" "git add .product-settings && git commit -m $(q "$MSG") -- .product-settings")"
}

cmd_inspect() {
  state=$(settings_state "$HERE")
  if [ "$state" = none ]; then echo "here: none"; else echo "here: $HERE/$(product_name "$HERE")"; fi
  echo "settings: $state"
  if [ "$state" = ok ]; then echo "mode: $(settings_mode "$HERE")"; else echo "mode: none"; fi
  a=$(ancestor "$HERE")
  echo "ancestor: ${a:-none}"
  if inside_git; then
    top=$(git_top)
    echo "git.inside: true"
    echo "git.top: $top"
    if [ "$top" = "$HERE" ]; then echo "git.isTop: true"; else echo "git.isTop: false"; fi
    if git rev-parse --verify -q HEAD >/dev/null 2>&1; then echo "git.hasCommits: true"; else echo "git.hasCommits: false"; fi
  else
    echo "git.inside: false"
    echo "git.top: none"
    echo "git.isTop: false"
    echo "git.hasCommits: false"
  fi
}

cmd_internal() {
  case ${1:-} in top | here) ;; *) echo "사용법: setup.sh internal top|here" >&2; exit 1 ;; esac
  if ! inside_git; then
    # E12
    echo STOPPED
    echo "reason: $HERE 는 git 리포 안이 아니라 내부 셋업을 멈췄다. 리포 밖에서는 외부 셋업을 쓴다"
    echo "next: setup.sh external <리포 주소>"
    exit 6
  fi
  top=$(git_top)
  if [ "$top" = "$HERE" ] || [ "$1" = here ]; then target=$HERE; else target=$top; fi
  if is_product_root "$target"; then
    already "$target" && return
    settings_only "$target" internal
    return
  fi
  make_product "$target" || exit 1
  write_settings "$target" internal || exit 1
  # U3: 두 파일을 경로로 지정해 커밋해서 미리 올려 둔 다른 변경을 섞지 않는다
  # shellcheck disable=SC2086
  if err=$({ git -C "$target" add -- $FILES && git -C "$target" commit -q -m "$MSG" -- $FILES; } 2>&1 >/dev/null); then
    branch=$(git -C "$target" symbolic-ref --short -q HEAD || echo HEAD)
    echo DONE
    echo "mode: internal"
    echo "productDir: $target/.product"
    echo "commit: $(git -C "$target" rev-parse HEAD)"
    echo "next: $(in_dir "$target" "git push origin $(q "$branch")")"
  else
    # E13. 파일은 남기고 --no-verify 로 우회하지 않는다
    reason=$(last_line "$err")
    echo COMMIT_FAILED
    echo "mode: internal"
    echo "productDir: $target/.product"
    echo "reason: ${reason:-git commit 이 실패했다}"
    echo "next: $(in_dir "$target" "git add $FILES && git commit -m $(q "$MSG") -- $FILES")"
    exit 7
  fi
}

cmd_external() {
  if [ $# -eq 0 ]; then echo "사용법: setup.sh external <리포 주소>..." >&2; exit 1; fi
  if is_product_root "$HERE"; then
    already "$HERE" && return
    settings_only "$HERE" external
    return
  fi
  if inside_git; then
    top=$(git_top)
    if [ "$top" != "$HERE" ]; then
      # E5
      echo STOPPED
      echo "reason: $HERE 는 다른 git 리포($top)의 하위 폴더라 외부 셋업을 멈췄다. 리포 밖 폴더에서 다시 부른다"
      exit 6
    fi
  else
    # E4
    git init -q || exit 1
  fi
  gitdir=$(git rev-parse --absolute-git-dir)
  nl='
'
  seen=$nl
  added=''
  skipped=''
  skip_next=''
  for url in "$@"; do
    name=$(repo_name "$url")
    if [ -z "$name" ]; then
      skipped="${skipped}skipped: $url 주소에서 리포 이름을 읽을 수 없다$nl"
      skip_next="${skip_next}next: git submodule add $(q "$url") repos/<이름>$nl"
      continue
    fi
    case $seen in
      *"$nl$name$nl"*)
        # E8
        skipped="${skipped}skipped: $url repos/$name 이름이 앞 주소와 겹친다$nl"
        skip_next="${skip_next}next: git submodule add $(q "$url") repos/$(q "$name")$nl"
        continue
        ;;
    esac
    seen="$seen$name$nl"
    path="$HERE/repos/$name"
    modules="$gitdir/modules/repos/$name"
    had_path=0; [ -e "$path" ] && had_path=1
    had_modules=0; [ -e "$modules" ] && had_modules=1
    if err=$(git submodule add -q "$url" "repos/$name" 2>&1 >/dev/null); then
      added="${added}$name$nl"
    else
      # E7. 이번 실행이 만든 흔적만 지운다
      [ "$had_path" = 0 ] && [ -e "$path" ] && rm -rf "$path"
      [ "$had_modules" = 0 ] && [ -e "$modules" ] && rm -rf "$modules"
      reason=$(last_line "$err")
      skipped="${skipped}skipped: $url ${reason:-git submodule add 가 실패했다}$nl"
      skip_next="${skip_next}next: git submodule add $(q "$url") repos/$(q "$name")$nl"
    fi
  done
  make_product "$HERE" || exit 1
  write_settings "$HERE" external || exit 1
  echo DONE
  echo "mode: external"
  echo "productDir: $HERE/.product"
  printf '%s' "$added" | sed 's/^/added: /'
  printf '%s' "$skipped"
  printf '%s' "$skip_next"
  # F1: 커밋은 사용자가 한다
  echo "next: git add $FILES && git commit -m $(q "$MSG")"
  printf '%s' "$added" | sed 's#.*#next: 앞으로 개발은 repos/&/ 에서 한다#'
}

cmd=${1:-}
[ $# -gt 0 ] && shift
case $cmd in
  inspect) cmd_inspect ;;
  external) cmd_external "$@" ;;
  internal) cmd_internal "$@" ;;
  settings-only)
    case ${1:-} in external | internal) settings_only "$HERE" "$1" ;; *) echo "사용법: setup.sh settings-only external|internal" >&2; exit 1 ;; esac
    ;;
  *)
    echo "사용법: setup.sh inspect | external <리포 주소>... | internal top|here | settings-only external|internal" >&2
    exit 1
    ;;
esac
