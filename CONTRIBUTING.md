# Contributing

Thank you for helping make public professional histories more truthful and portable.

1. Open an issue describing the problem, compatibility impact, and public-data implications.
2. Create a focused branch and add tests with the change.
3. Keep all example data synthetic or explicitly approved for public use.
4. Run `npm ci`, `npm run phase2`, and `git diff --check`.
5. Open a pull request that explains the behavior change and any schema or lifecycle decision.

Schema changes require a documented migration and must not silently weaken lifecycle, evidence, locale, or provenance constraints. By contributing, you agree that your contribution is licensed under the MIT License.
