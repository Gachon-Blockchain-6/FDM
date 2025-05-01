# 설치 가이드
## 1. node_modules를 포함한 모든 파일을 다운로드 받습니다.
## 2. 파일의 압축을 해제합니다.
## 3. 메모장을 관리자 권한으로 실행한 후 C:\Windows\System32\drivers\hosts를 열어 아래 내용을 추가합니다. (리버스 프록시 설정에 사용합니다.)
127.0.0.1    fdm.com

## 4. docker-compose.yaml이 있는 폴더에서 docker-compose up -d 명령어로 빌드합니다.
## 5. docker network inspect docker network inspect fdm_app-network로 네트워크에 모든 컨테이너가 포함되어 있는지 확인합니다.
## 6. 포함되어 있지 않다면,
## docker network connect fdm_app-network backend-container; docker network connect fdm_app-network frontend-container; docker network connect fdm_app-network mysql-container; docker network connect fdm_app-network nginx-## container; docker network connect fdm_app-network image-container로 네트워크에 컨테이너를 포함시켜 줘야 합니다.
## 7. http://fdm.com:80 으로 접속하여 접속이 잘 되는지 확인합니다. 테스트용으로 loginid : m, password : m 의 관리자 계정이 sql 생성 시 기본으로 생성됩니다. (https는 지원하지 않습니다.)
## 8. Minio 설정을 위해 호스트 ip:9001(MiniO 관리 포트)로 접근하여 id: minioadmin, pw: minioadmin으로 로그인합니다.
## 9. uploads 버킷을 생성하고, 권한을 public으로 설정합니다.

## 10. 설치가 완료되었습니다! 아래는 기능 설명입니다.
## 11. 로그인하지 않은 사용자는 게시판 글을 볼 수만 있고, 파일 업로드도 가능하지만 포인트는 지급되지 않습니다.
## 11. 로그인 한 사용자(manager 포함)은 게시판 글을 작성할 수 있고, 본인이 쓴 글에 한해서 삭제가 가능하며, 비밀번호가 일치할 경우 수정도 가능합니다.
## 11. 관리자는 모든 글에 대해서 수정/삭제가 비밀번호 없이 가능합니다.
## 12. 모든 사용자는 이미지 업로드 시 포인트가 10 지급되며, 이는 home에서 확인할 수 있습니다.
* 이 프로젝트는 Docker desktop 환경에서 개발되었습니다.

<Github 사용법> - Curated and Refined by ChatGPT 4.5 

0. 디렉토리 탐색

0-1. 윈도우 cd <경로> : 원하는 디렉토리로 이동합니다. dir : 현재 디렉토리의 파일 및 폴더 목록을 확인합니다.

0-2. 리눅스/맥 cd <경로> : 원하는 디렉토리로 이동합니다. pwd : 현재 디렉토리의 경로를 확인합니다. ls -al : 현재 디렉토리의 파일 및 폴더 목록을 자세히 확인합니다. tree : 디렉토리 구조를 트리 형태로 확인합니다. (별도 설치 필요)

1. Git 사용자 정보 설정

1-1. 사용자 정보 추가 git config --global user.name "<사용자 이름>" git config --global user.email "<사용자 이메일>"

1-2. 사용자 정보 삭제 git config --global --unset user.name "<사용자 이름>"
1-2. 사용자 정보 삭제 git config --global --unset-all user.name 
1-2. 사용자 정보 삭제 git config --global --unset user.email "<사용자 이메일>"
1-2. 사용자 정보 삭제 git config --global --unset-all user.email

1-3. 사용자 정보 확인 git config --global --list

2. 원격 저장소(remote) 설정

2-1. 원격 저장소 추가 git remote add origin <원격 저장소 주소>

2-2. 원격 저장소 확인 git remote -v

3. Git Bash 실행

3-1. 윈도우 탐색기에서 원하는 폴더를 우클릭 후 "Git Bash Here" 선택

3-2. 리눅스/맥 터미널을 실행한 후 원하는 디렉토리로 이동

4. Git 저장소 초기화

4-1. 새 저장소 초기화 git init

4-2. 기존 저장소 복제 git clone <원격 저장소 주소>

5. 파일 스테이징(Staging)

5-1. git add . : 현재 디렉토리의 모든 변경 사항을 스테이징합니다. 
5-2. git add -A : 현재 및 하위 디렉토리의 모든 변경 사항을 스테이징합니다. 
5-3. git add <파일명> : 특정 파일의 변경 사항만 스테이징합니다.

※ 이 단계에서는 변경 사항이 아직 커밋되지 않습니다.

6. 브랜치(Branch) 이해하기

브랜치는 작업 흐름을 분리하여 협업과 변경사항 관리를 돕는 기능입니다.

6-1. 브랜치 목록 보기 git branch : 로컬 브랜치 목록 확인 
6-2. git branch -a : 모든 로컬 및 원격 브랜치 목록 확인

6-3. 브랜치 이동 및 생성 git checkout <브랜치명> : 특정 브랜치로 이동 git checkout -b <새 브랜치명> : 새 브랜치를 생성하고 이동

6-4. 원격 브랜치 최신 상태 동기화 git fetch --all

6-5. 브랜치 삭제 git branch -d <브랜치명> : 로컬 브랜치를 삭제 
6-6. git push origin --delete <브랜치명> : 원격 브랜치를 삭제

* commit과 push의 차이

commit : 로컬 컴퓨터에만 변경 사항을 저장합니다. push : 로컬 컴퓨터에 commit된 내용을 원격 저장소(GitHub)에 올려 협업자들과 공유합니다.

※ commit 후 반드시 push를 해야 협업자에게 공유됩니다.

7. 변경 사항 커밋(commit)
커밋은 변경 사항을 버전 단위로 저장하는 작업입니다.

7-1. git commit -m "<커밋 메시지>" : 스테이징된 변경 사항을 커밋합니다. 
7-2. git commit --amend : 직전의 커밋 메시지나 내용을 수정합니다.

※ push 전까지는 로컬에만 저장됩니다.

8. 커밋 해시 확인 및 되돌리기

8-1. 커밋 해시 확인 git log : 최근 커밋 내역과 해시값을 확인합니다.

8-2. 커밋 되돌리기 git reset --hard <커밋 해시> : 특정 커밋으로 완전히 돌아갑니다. (변경 사항 삭제됨) git reset --soft <커밋 해시> : 특정 커밋으로 돌아가지만 이후 변경 사항을 유지합니다.

8-3. 변경 사항 임시 저장(stash) git stash : 변경 사항을 임시로 저장합니다. git stash pop : 임시 저장된 내용을 다시 불러옵니다.

9. 변경 사항 원격 저장소와 동기화(push/pull)

9-1. pull (가져오기) git pull origin <브랜치명> : 원격 저장소의 최신 내용을 로컬로 받아옵니다.

9-2. push (올리기) git push origin <브랜치명> : 로컬의 변경 사항을 원격 저장소로 올립니다.

※ push하기 전에 반드시 pull을 실행하여 충돌을 예방합니다.

10. Pull Request(PR) 생성 및 관리

Pull Request(PR)는 변경 사항을 팀원들과 리뷰하고 최종적으로 원격 저장소에 병합(merge) 요청을 하는 기능입니다.

10-1. GitHub 웹에서 PR 생성 ① GitHub에서 "Pull requests" 탭 선택 ② "New pull request" 버튼 클릭 ③ base 브랜치(일반적으로 main)와 내 브랜치 선택 ④ 변경 사항 확인 후 "Create pull request" 클릭 ⑤ 제목과 설명 입력 후 최종 제출

10-2. CLI에서 PR 생성 (GitHub CLI 설치 필요) gh pr create --base <기준 브랜치> --head <내 브랜치> --title "<제목>" --body "<설명>"

※ PR 제출 후 팀원들이 코드 리뷰를 통해 승인 또는 수정을 요청할 수 있습니다.
