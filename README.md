# Chung

이 저장소의 `key` 디렉터리에는 JSON 기반 문제/답변을 다루기 위한 파이썬 도구들이 포함되어 있습니다.

## 제공되는 도구

- `main.py`: PyQt5 기반 GUI 편집기입니다. 새 JSON 파일을 생성하거나 기존 파일을 열어 항목을 추가/수정/삭제할 수 있습니다.
- `json_input.py`: 터미널에서 JSON 파일을 불러와 항목을 선택하고, 답변을 자모 단위로 순차 출력하는 CLI 도구입니다.
- `qa.json`: 기본 예시 데이터입니다. 필요한 경우 자유롭게 수정하여 사용하세요.

## 실행 방법

### GUI 편집기
```bash
python key/main.py
```

### CLI 출력 도구
```bash
python key/json_input.py [경로/파일명.json]
```
경로를 생략하면 `key/qa.json` 파일을 기본으로 사용합니다.

CLI 도구에서 `help` 명령을 입력하면 사용 가능한 명령 목록을 확인할 수 있습니다.
