# RAPID CDK

AWS CDK infrastructure for the RAPID project. See the [top-level README](../README.md)
for full deployment instructions and parameter customization.

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Deploy

From a fresh checkout, `npm run deploy` builds all packages (backend, the
review invoke-agent Lambda, and CDK) and deploys automatically:

```bash
cd cdk
npx cdk bootstrap
npm run deploy
```

`npx cdk bootstrap` is required only once per account/region.

## Manual step-by-step deployment

```bash
cd backend
npm ci
npm run prisma:generate
npm run build
cd ../cdk
npm ci
npx cdk deploy --require-approval never --all
```

`npm ci` in `cdk/` also prepares the backend Prisma client (`preinstall`) and
builds the invoke-agent Lambda (`postinstall`), so no extra build step is
needed before `cdk deploy`.

## Other commands

- `npm run build` compile CDK TypeScript to js (run `npm ci` first)
- `npm run build:all` build backend + invoke-agent Lambda + CDK
- `npm run watch` watch for changes and compile
- `npm run test` run the jest unit tests
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emit the synthesized CloudFormation template
