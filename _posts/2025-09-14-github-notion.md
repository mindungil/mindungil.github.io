---
title: github 블로그 및 notion 연동
date: 2025-09-14 16:52:00 +0900
lastmod: 2025-09-27 14:42:00 +0900
categories: [일상, 블로그]
tags: [일상]
author: 길민준
image: {path: /assets/img/for_post/github-notion/cover-04.png, alt: github 블로그 및 notion 연동}
---


## 개요


Notion에서 공부 및 일상을 기록하는 것을 블로그에 다시 올리는 과정이 불편해서,


자동 배포 파이프라인을 구성하려고 함.


## 본문


### 파이프라인 구성

1. notion에서 특정 속성(배포: 체크박스)를 통해 배포 트리거 발동
2. github workflow를 통해 24:00 시 체크박스 체크 시 자동 push
3. [github.io](http://github.io/) 레파지토리 내부 스크립트를 통해 json→markdown 변환 및 프론트매터 구성(제목, 태그 등 가져오기)
4. [github.io](http://github.io/) 본래의 workflow 실행 후 블로그 반영

### 주요 기능

- 카테고리 - 카테고리, 분류 - 소 카테고리 매핑
- 환경변수 및 secret 키 적절히 등록
- 기존에 배포했던 페이지를 다시 올릴 경우 덮어쓰기 반영 - 적절한 수정 구현

### 개선점

- 트리거 시 즉시 배포 고려

    체크박스 시 즉시 반영하는 로직도 고민하였으나, 노션을 활용하는 방식 상 수정이 때때로 이루어지는 경우가 많음. 


    따라서 선택적 옵션으로 추가 구현하는 것이 적당해보인다고 판단했음.


해당 레파지토리: [https://github.com/mindungil/n2g](https://github.com/mindungil/n2g)


블로그 주소: [https://mindungil.github.io/](https://mindungil.github.io/)


