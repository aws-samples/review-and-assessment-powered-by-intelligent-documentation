# ローカル開発環境セットアップ

このドキュメントでは、本サンプルのローカル開発環境のセットアップ方法について説明します。

## 前提条件

- Node.js (v18 以上)
- Docker および Docker Compose
- AWS CLI（設定済み）
- Python (v3.13 以上)

## バックエンドのセットアップ

### 1. データベースの起動

プロジェクトの`assets/local`ディレクトリで以下のコマンドを実行し、MySQL データベースを起動します：

```bash
docker-compose up -d
```

これにより、以下の設定で MySQL データベースが起動します：

- ホスト: localhost
- ポート: 3306
- データベース名: rapid_db
- ユーザー名: rapid_user
- パスワード: rapid_password

NOTE: DB のデータリセットしたい場合、下記のコマンドでボリュームを削除して再作成可能です

```bash
docker-compose down -v
docker-compose up -d
```

### 2. バックエンドの依存関係インストール

```bash
cd backend
npm ci
npm run prisma:generate  # Prismaクライアントの生成
```

### 3. データベースのマイグレーションと初期データ投入

```bash
cd backend
npm run prisma:migrate   # データベースのマイグレーション
npm run db:seed         # 初期データの投入
```

### 4. 環境変数のセットアップ

```sh
export RAPID_LOCAL_DEV=true
```

以下はオプショナルの設定です。設定した場合、チェックリスト作成や審査ジョブの作成も動作します。

```sh
export DOCUMENT_BUCKET=rapidstack-xxxx-nlxgu42ywz9g
export AWS_REGION=ap-northeast-1
export DOCUMENT_PROCESSING_STATE_MACHINE_ARN=arn:aws:states:ap-northeast-1:1234567890:stateMachine:DocumentProcessorDocumentProcessingWorkflowXXXX
export REVIEW_PROCESSING_STATE_MACHINE_ARN=arn:aws:states:ap-northeast-1:1234567890:stateMachine:ReviewProcessorReviewProcessingWorkflowXXXX
```

### 5. バックエンドサーバーの起動

```bash
cd backend
npm run dev
```

バックエンドサーバーは http://localhost:3000 で起動します。

## フロントエンドのセットアップ

### 1. 依存関係のインストール

```bash
cd frontend
npm install
```

### 2. 環境変数の設定

フロントエンドディレクトリに `.env.example` ファイルがあるので、それを参考に各自`.env.local`ファイルを作成

### 3. 開発サーバーの起動

```bash
cd frontend
npm run dev
```

フロントエンドの開発サーバーは http://localhost:5173 で起動します。

## 動作確認

1. バックエンド API: http://localhost:3000/api/health にアクセスして、正常に応答があることを確認します。
2. フロントエンド: http://localhost:5173 にアクセスして、アプリケーションが表示されることを確認します。

## データベース管理

Prisma Studio を使用してデータベースを視覚的に管理できます：

```bash
cd backend
npm run prisma:studio
```

Prisma Studio は http://localhost:5555 で起動します。

## テスト実行

バックエンドのテストを実行するには：

```bash
cd backend
npm test
```

特定のテストスイートのみを実行するには：

```bash
cd backend
npm run test -- test-suite
```

## ビルド

バックエンドをビルドするには：

```bash
cd backend
npm run build
```

フロントエンドをビルドするには：

```bash
cd frontend
npm run build
```

### Python Lambda 関数の依存関係更新

本サンプルは TypeScript を基本的に利用していますが、一部（以下）の Lambda 関数で Python を利用しています：

1. **MCP Runtime** (`cdk/lib/constructs/mcp-runtime/python/`)
2. **Review Item Processor** (`review-item-processor/`)

各プロジェクトでは依存関係ロックのため Poetry を利用しています。

#### 依存関係の更新（スクリプト）

各 Python Lambda 関数ディレクトリで以下を実行：

```bash
# MCP Runtime の場合
./scripts/update-python-requirements.sh cdk/lib/constructs/mcp-runtime/python

# Review Item Processor の場合
./scripts/update-python-requirements.sh backend/src/review-workflow/review-item-processor

# 全てのPython Lambda関数を一括更新（推奨）
./scripts/update-all-python-requirements.sh

# または個別に更新
./scripts/update-python-requirements.sh cdk/lib/constructs/mcp-runtime/python
./scripts/update-python-requirements.sh backend/src/review-workflow/review-item-processor
```

#### 依存関係の更新（手動）

統一スクリプトを使わない場合は、以下を手動実行：

```bash
# 1. Poetry lockファイルの更新
poetry lock

# 2. requirements-locked.txtの生成
poetry export -f requirements.txt --output requirements-locked.txt --without-hashes
```

#### 新しい依存関係の追加

```bash
# 依存関係の追加
poetry add package-name

# 開発用依存関係の追加
poetry add --group dev package-name

# 依存関係更新後は必ずrequirements-locked.txtを更新
./scripts/update-python-requirements.sh <python-lambda-directory>
```

## トラブルシューティング

### データベース接続エラー

データベース接続エラーが発生した場合は、以下を確認してください：

1. Docker コンテナが実行中であることを確認：

   ```bash
   docker ps
   ```

2. データベース接続情報が正しいことを確認：

   ```bash
   cat backend/.env
   ```

3. 必要に応じてデータベースコンテナを再起動：
   ```bash
   docker-compose restart mysql
   ```
