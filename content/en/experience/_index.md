---
title: 'Experience'
date: 2024-10-04
type: landing

design:
  background:
    image:
      # Add your image background to `asssets/media`.
      filename: cat.jpg
      # '사진: <a href="https://unsplash.com/ko/%EC%82%AC%EC%A7%84/%ED%91%B8%EB%A5%B8-%ED%95%98%EB%8A%98%EC%97%90-%ED%9D%B0-%EA%B5%AC%EB%A6%84-UiiHVEyxtyA?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>의<a href="https://unsplash.com/ko/@fakurian?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Milad Fakurian</a>'
      filters:
        brightness: 1.0
        size: cover
        position: center
        parallax: true
  spacing: '5rem'

# Note: `username` refers to the user's folder name in `content/authors/`

# Page sections
sections:
  - block: resume-experience
    content:
      username: admin
    design:
      # Hugo date format
      date_format: ''
      # Education or Experience section first?
      is_education_first: false
  - block: markdown
    content:
      title: School map
      address:
        street: Junbuk National University
        city: Jeonju
        region: Jeollabuk-do
        postcode: '54896'
        country: Korea
        country_code: KO
      coordinates:
        latitude: '35.845757268789846'
        longitude: '127.1295454368192'
      directions:
      autolink: true
  - block: resume-skills
    content:
      title: Skills & Hobbies
      username: admin
    design:
      show_skill_percentage: false
  - block: resume-languages
    content:
      title: Languages
      username: admin
---
