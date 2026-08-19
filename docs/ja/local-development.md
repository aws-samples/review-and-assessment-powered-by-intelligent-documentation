# ローカル開発

このドキュメントでは、開発のために RAPID のバックエンドとフロントエンドを手元のマシンで実行する方法を説明します。アーキテクチャは[開発者ガイド](./developer-guide.md#アーキテクチャ)を、アプリケーションのデプロイは [README](./README_ja.md#デプロイ方法) をご覧ください。

## 目次

- [前提条件](#前提条件)
- [バックエンドのセットアップ](#バックエンドのセットアップ)
- [フロントエンドのセットアップ](#フロントエンドのセットアップ)
- [動作確認](#動作確認)
- [データベース管理（Prisma Studio）](#データベース管理prisma-studio)
- [テストの実行](#テストの実行)
- [ビルド](#ビルド)
- [Python エージェント（review-item-processor）](#python-エージェントreview-item-processor)
- [トラブルシューティング](#トラブルシューティング)

## 前提条件

- **Node.js v22**（推奨。バックエンドの動作要件は v20 以上、CI は v22 で実行しています）
- **Docker / Docker Compose** — ローカルの MySQL データベースを実行します
- **AWS CLI（設定済み）** — Cognito ユーザーの作成や、デプロイ済みスタックへのオプション機能の接続に使用します
- **Python 3.13 以上と [uv](https://docs.astral.sh/uv/)** — 審査エージェント（`review-item-processor/`）を扱う場合のみ必要です
- **デプロイ済みの `RapidStack`** — フロントエンドはデプロイ済みの Amazon Cognito User Pool に対してサインインします（フロントエンドにローカル用の認証バイパスはありません）。また、アップロードやワークフロー系の機能はデプロイ済みの AWS リソースを呼び出します

## バックエンドのセットアップ

### 1. ローカルデータベースの起動

リポジトリのルートで実行します。

```bash
docker compose -f assets/local/docker-compose.yml up -d
```

これにより、MySQL 8.0 のコンテナ（デプロイ先の Aurora MySQL バージョン 3 が互換性を持つ MySQL バージョンと同じ）が以下の設定で起動します。

- ホスト: `localhost` / ポート: `3306`
- データベース名: `rapid` / ユーザー名: `rapid_user` / パスワード: `rapid_password`

同梱の初期化スクリプトが Prisma のシャドウデータベース作成に必要な権限を付与するため、`prisma migrate dev` はそのまま動作します。データをリセットしたい場合は、ボリュームを削除して再起動します。

```bash
docker compose -f assets/local/docker-compose.yml down -v
docker compose -f assets/local/docker-compose.yml up -d
```

### 2. 依存関係のインストールとスキーマの適用

`DATABASE_URL` は Prisma CLI とローカルサーバーの両方で必須です。値は `assets/local/docker-compose.yml` と一致させます。

```bash
cd backend
npm ci
export DATABASE_URL="mysql://rapid_user:rapid_password@localhost:3306/rapid"
npm run prisma:generate
npm run prisma:migrate
```

リポジトリには、ローカル開発用テンプレートとして追跡されている `backend/prisma/.env` がすでに含まれており、Prisma が自動で読み込みます。既定値は `assets/local/docker-compose.yml` と一致しています。このファイルを実際の資格情報で置き換えたり、シークレットを commit したりしないでください。ローカル以外のデータベースを使う場合は、代わりにシェルで `DATABASE_URL` を export します。

### 3. 環境変数の設定

```bash
export RAPID_LOCAL_DEV=true
```

`RAPID_LOCAL_DEV=true` を設定すると、ローカルバックエンドの認証がバイパスされ、すべてのリクエストがモックの**管理者**ユーザーとして実行されます（このフラグは Lambda 上では無効です）。

オプションで、ローカルバックエンドをデプロイ済みスタックのリソースへ接続できます。これにより、ドキュメントのアップロード／ダウンロード（Amazon S3 の presigned URL）、チェックリスト抽出・審査ジョブの投入、曖昧性検出、項目ごとのモデル選択リストが有効になります。

```bash
export AWS_REGION="<region of your RapidStack>"
export DOCUMENT_BUCKET="<document bucket name>"
export DOCUMENT_PROCESSING_STATE_MACHINE_ARN="<Checklist Processor state machine ARN>"
export REVIEW_QUEUE_URL="<review queue URL>"
export AMBIGUITY_DETECTION_QUEUE_URL="<ambiguity detection queue URL>"
export AVAILABLE_MODELS='[{"modelId":"global.anthropic.claude-sonnet-5","displayName":"Claude Sonnet 5 (Global)"}]'
```

各値は、デプロイ済みスタックの AWS コンソール（Amazon S3／Step Functions／SQS）で確認できます。なお、抽出・審査のワークフロー自体は AWS アカウント側で実行され、結果はローカルの MySQL ではなくデプロイ済みの Aurora データベースに書き込まれるため、ローカル UI から投入したジョブの結果はローカルには表示されません。

### 4. 開発サーバーの起動

```bash
cd backend
npm run dev
```

バックエンドは `http://localhost:3000` で起動します。

## フロントエンドのセットアップ

```bash
cd frontend
npm ci
cp .env.example .env.local
```

`.env.local` を編集します。

- `VITE_APP_USER_POOL_ID` / `VITE_APP_USER_POOL_CLIENT_ID` / `VITE_APP_REGION` — CDK デプロイ出力（`RapidStack.AuthUserPoolId...` / `RapidStack.AuthUserPoolClientId...`）または Amazon Cognito コンソールから取得します
- `VITE_APP_API_ENDPOINT` — ローカルバックエンドを使う場合は `http://localhost:3000`（未設定時のフォールバック値も同じです）

続いて開発サーバーを起動します。

```bash
cd frontend
npm run dev
```

フロントエンドは `http://localhost:5173` で起動します。デプロイ済み User Pool のユーザーでサインインしてください（[管理者の初期セットアップ](./README_ja.md#管理者の初期セットアップ)参照）。バックエンドの認可は `RAPID_LOCAL_DEV` でバイパスされますが、フロントエンドのサインイン画面自体には実際の Cognito ユーザーが必要です。

## 動作確認

```bash
curl http://localhost:3000/health
```

1. バックエンド: 上記のヘルスチェックエンドポイントが成功レスポンスを返すことを確認します。
2. フロントエンド: `http://localhost:5173` を開いてサインインし、アプリケーションが表示されることを確認します。

## データベース管理（Prisma Studio）

Prisma Studio でローカルデータベースを視覚的に閲覧・編集できます（前述のとおり `DATABASE_URL` が必要です）。

```bash
cd backend
npm run prisma:studio
```

Prisma Studio は `http://localhost:5555` で起動します。

## テストの実行

バックエンド（Vitest）:

```bash
cd backend
npm test
```

特定のテストスイートのみを実行するには:

```bash
npm run test -- "<suite>"
```

フロントエンド（Vitest）:

```bash
cd frontend
npm test
```

審査エージェント（uv 経由の pytest）。`pytest` はオプションの `dev` extra に含まれるため、一度だけ同期が必要です（素の `uv sync` はオプションの extra をインストールしません）:

```bash
cd review-item-processor
uv sync --extra dev
uv run pytest
```

## ビルド

```bash
cd backend
npm run build
```

```bash
cd frontend
npm run build
```

フロントエンドのナビゲーションやアセットの扱いを変更した場合は、S3 + API Gateway 配信で使われるステージパス付きビルドも確認してください。

```bash
cd frontend
VITE_APP_BASE_PATH=/app/ npm run build
```

## Python エージェント（review-item-processor）

審査エージェントは Python 製で、依存関係は uv で管理しています。

```bash
cd review-item-processor
uv sync
uv lock
```

依存関係を追加するには:

```bash
uv add package-name
uv add --dev package-name
```

## トラブルシューティング

**データベース接続エラー**

コンテナが実行中であることを確認します。

```bash
docker ps
```

接続文字列を確認します。`DATABASE_URL` を export している場合は `echo $DATABASE_URL` を確認し、そうでない場合は追跡済みのローカル既定値 `backend/prisma/.env` を使って、`assets/local/docker-compose.yml` の値と比較してください。追跡されているテンプレートに実際の資格情報を保存しないでください。必要に応じてデータベースコンテナを再起動します。

```bash
docker compose -f assets/local/docker-compose.yml restart mysql
```

Prisma の generate エラーやマイグレーションの問題などは、[開発者ガイドのトラブルシューティング](./developer-guide.md#トラブルシューティング)をご覧ください。
