/** @type {import('tailwindcss').Config} */
// Built with: npx tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o tailwind.bundle.css --minify
module.exports = {
    "theme": {
      "extend": {
        "colors": {
          "rcem-purple": "#2d2e83",
          "rcem-light": "#4a4bc4"
        },
        "fontFamily": {
          "sans": ["Inter", "system-ui", "sans-serif"],
          "serif": ["Merriweather", "Georgia", "serif"]
        }
      }
    },
    "content": ["./a3-export.js", "./ai-review.js", "./ai.js", "./app.js", "./audit-log.js", "./charts.js", "./config.js", "./data-entry.js", "./diagrams.js", "./emqiat-shared.js", "./emqiat.js", "./export-center.js", "./export.js", "./green-calculator.js", "./index.html", "./invites.js", "./kaizen-export.js", "./learn.js", "./measures.js", "./onboarding.js", "./patient-tracker.js", "./project-metrics.js", "./qip-lead.js", "./renderers.js", "./scripts/smoke-test.js", "./state.js", "./supervisor.js", "./surveys.js", "./sw.js", "./utils.js"],
    "safelist": []
  };
