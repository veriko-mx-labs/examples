# Contributing

Issues and pull requests are welcome.

## Report a bug or request a change

Open an issue with the [bug report](https://github.com/veriko-mx-labs/examples/issues/new?template=bug_report.yml) or [feature request](https://github.com/veriko-mx-labs/examples/issues/new?template=feature_request.yml) form. Search the open issues first.

A bug report needs the versions you use, the steps that reproduce it and, when the API answered with an error, its `request_id`. Remove API keys, receipts, account numbers and customer data from anything you paste.

Do not open a public issue for a security vulnerability. Follow [SECURITY.md](SECURITY.md).

## Propose a change

1. For anything larger than a fix, open an issue first so the change can be agreed before you write it.
2. Fork the repository and create a branch from `main`.
3. Make the change. Add the example with its `veriko:operation` line and its README row.
4. Run the checks of this repository:

   ```bash
   npm ci
   npm run lint
   npm test
   ```

   `npm run lint` checks the syntax of each example with the interpreters you have installed: `bash`, `node`, `python3` and `php`. CI also runs `node scripts/check-syntax.mjs --require`, which fails when an interpreter is missing. Use Node.js 18 or later, Python 3.9 or later and PHP 8.1 or later.
5. Update README.md when the behavior that users see changes.
6. Open a pull request against `main` and fill in the template.

Write commit messages in English, in the imperative, and keep one change in each commit.

A new example needs a `veriko:operation` line that declares the operations it calls, and a row in the flows table of the README. `npm test` checks both against the spec.

Examples do not send real data. Use made-up transfers and read the API key from `VERIKO_API_KEY`.

## The API contract

The API contract is the public spec at <https://docs.veriko.mx/openapi.yaml>. `spec/openapi.yaml` is a copy that a scheduled workflow syncs. Do not edit it by hand. When the API behaves differently from the spec, open an issue.
