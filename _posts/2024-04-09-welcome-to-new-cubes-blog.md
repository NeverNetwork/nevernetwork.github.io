---
layout: post
title: "Welcome to New Cubes Blog"
date: 2024-04-09
---

Welcome to the New Cubes Blog! This is a demonstration of how blog posts work with our Three.js visualization.

## About This Blog

This blog combines interactive 3D visualizations with written content. The main page features an interactive Three.js visualization of floating cubes, while the blog section contains detailed articles about various topics.

## Features

- Interactive 3D visualization on the main page
- Clean, modern design
- Responsive layout
- Markdown-based blog posts

## Getting Started

To create your own blog post:

1. Create a new Markdown file in the `_posts` directory
2. Use the front matter format shown above
3. Write your content in Markdown format
4. Add any images to the `assets` directory

## Code Example

Here's a simple example of how the Three.js visualization works:

```javascript
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// Add your 3D objects here
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
```

Stay tuned for more posts about Three.js, web development, and interactive visualizations! 