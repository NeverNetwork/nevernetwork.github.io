# New Cubes Blog

A blog featuring an interactive 3D visualization using Three.js, with blog posts written in Markdown.

## Features

- Interactive 3D cube visualization on the main page
- Blog posts written in Markdown
- Ruby-based local development server
- GitHub Pages deployment ready

## Setup

1. Make sure you have Ruby installed on your system
2. Install the required gems:
   ```bash
   gem install bundler
   bundle install
   ```
3. Start the local server:
   ```bash
   bundle exec jekyll serve
   ```
4. Visit `http://localhost:4000` in your browser

## Project Structure

```
.
├── _posts/           # Blog posts in Markdown format
├── assets/          # Static assets (CSS, JS, images)
│   ├── css/
│   ├── js/
│   └── three/      # Three.js related files
├── _layouts/        # Jekyll layout templates
├── _includes/       # Reusable Jekyll components
└── index.html      # Main page with Three.js visualization
```

## Adding Blog Posts

1. Create a new Markdown file in the `_posts` directory
2. Use the following front matter format:
   ```markdown
   ---
   layout: post
   title: "Your Post Title"
   date: YYYY-MM-DD
   ---
   ```
3. Write your blog post content in Markdown format

## Deployment

This site is configured for GitHub Pages deployment. Simply push your changes to the main branch, and GitHub Pages will automatically build and deploy your site.

## License

MIT License - feel free to use this template for your own projects. 