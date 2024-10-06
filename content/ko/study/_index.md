---
title: 공부
cms_exclude: true

sections:
  - block: collection
    content:
    title: 공부
    filters:
        folders:
          - study 
    design:
        background:
        image:
          # Add your image background to `asssets/media/`.
          filename: cat.jpg
          # '사진: <a href="https://unsplash.com/ko/%EC%82%AC%EC%A7%84/%ED%91%B8%EB%A5%B8-%ED%95%98%EB%8A%98%EC%97%90-%ED%9D%B0-%EA%B5%AC%EB%A6%84-UiiHVEyxtyA?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>의<a href="https://unsplash.com/ko/@fakurian?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Milad Fakurian</a>'
          filters:
            brightness: 1.0
          size: cover
          position: center
          parallax: true
        view: community/row-card
        fill_image: false
        columns: 3
# View.

# Optional header image (relative to `static/media/` folder).
banner:
  caption: ''
  image: 'basic.jpg'
---
