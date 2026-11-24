"""Store: 회원이 올린 Windows 앱을 운영자가 검토한 뒤 공개하고, 방문자가 내려받는다 (ADR-0012).

    models.py   테이블 (store_*). 기존 users 테이블은 바꾸지 않는다
    files.py    올린 파일·아이콘을 두는 폴더 (Settings.store_dir)
    analyze.py  설치 파일 분석 (JohnnyStore 의 pe_extractor). 별도 프로세스로 돌린다
    scan.py     ClamAV 검사 (clamscan)
    router.py   /api/store/ 엔드포인트
"""
