"""Showroom: 회원이 만든 웹 서비스를 소개하는 곳. 운영자가 승인한 뒤 공개한다 (ADR-0012, Store 와 같은 원칙).

    models.py   테이블 (showroom_*). 올리는 회원 정보는 Store 의 store_publishers 를 함께 쓴다
    service.py  공개 여부, 응답 모양, 주소 검사, 탈퇴 정리 (auth.py 가 부른다)
    router.py   /api/showroom/ 엔드포인트

파일은 내려받지 않는다. 서비스 주소(https)와 아이콘·화면 그림만 받는다. 그림은 Store 의 analyze.py 가 자식 프로세스에서 다시 그린다.
"""
