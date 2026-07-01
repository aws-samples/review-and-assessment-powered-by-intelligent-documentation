# RAPID CDK

AWS CDK infrastructure for the RAPID project. See the [top-level README](../README.md)
for full deployment instructions and parameter customization.

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## Deploy

From a fresh checkout, `npm run deploy` builds all packages (backend, the
invoke-agent lambda, and CDK) and deploys automatically:

```
cd cdk
npx cdk bootstrap   # one-time per account/region
npm run deploy
```

> Note: `npm run deploy` uses the `review` AWS profile. If you use a different
> profile, adjust the `deploy` script in `package.json` (or deploy manually,
> see below).

## Manual step-by-step deployment

```bash
# Prepare the backend
cd backend
npm ci
npm run prisma:generate
npm run build

# Install CDK packages and deploy
cd ../cdk
npm ci
npx cdk deploy --require-approval never --all
```

## Other commands

* `npm run build`      compile CDK TypeScript to js (run `npm ci` first)
* `npm run build:all`  build backend + invoke-agent lambda + CDK
* `npm run watch`      watch for changes and compile
* `npm run test`       run the jest unit tests
* `npx cdk diff`       compare deployed stack with current state
* `npx cdk synth`      emit the synthesized CloudFormation template
