---
title: Hobby
summary: my hobby
type: landing

cascade:
  - _target:
      kind: page
    params:
      show_breadcrumb: true

sections:
  - block: collection
    id: hobby
    content:
      title: Hobby
      filters:
        folders:
          - hobby
    design:
      view: article-grid
      columns: 3
---