/**
 * データベースシードスクリプト
 *
 * このスクリプトは初期データをデータベースに投入するためのものです。
 * Prismaのseed機能と連携して使用します。
 */

import { PrismaClient, Prisma } from "../api/core/db";
import { ulid } from "ulid";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("シードデータの投入を開始します...");

  // 既存のデータがあるか確認
  const existingSetCount = await prisma.checkListSet.count();
  if (existingSetCount > 0) {
    console.log("初期データは既に存在します。シードをスキップします。");
    return;
  }

  // 1. 基本契約書チェックリストセットの作成
  const contractCheckListSetId = ulid();
  const contractCheckListSet = await prisma.checkListSet.create({
    data: {
      id: contractCheckListSetId,
      name: "基本契約書チェックリスト",
      description: "契約書の基本的な項目をチェックするためのセット",
    },
  });
  console.log(
    `チェックリストセットを作成しました: ${contractCheckListSet.name}`
  );

  // 親チェックリスト項目の作成
  const parentCheckId = ulid();
  const parentCheck = await prisma.checkList.create({
    data: {
      id: parentCheckId,
      name: "基本契約情報の確認",
      description: "契約書の基本的な情報が正しく記載されているかの確認",
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`親チェックリスト項目を作成しました: ${parentCheck.name}`);

  // 子チェックリスト項目の作成
  const childCheck1 = await prisma.checkList.create({
    data: {
      id: ulid(),
      name: "契約当事者の記載",
      description: "契約書に両当事者の正式名称が正確に記載されているか",
      parentId: parentCheckId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`子チェックリスト項目を作成しました: ${childCheck1.name}`);

  const childCheck2 = await prisma.checkList.create({
    data: {
      id: ulid(),
      name: "契約日の記載",
      description: "契約締結日が明記され、両当事者の合意日と一致しているか",
      parentId: parentCheckId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`子チェックリスト項目を作成しました: ${childCheck2.name}`);

  // フローチャート型チェックリスト項目の作成
  const flowStartId = ulid();
  const yesNodeId = ulid();
  const noNodeId = ulid();
  const conclusionYesId = ulid();
  const conclusionNoId = ulid();

  // フローの開始ノード
  const flowStart = await prisma.checkList.create({
    data: {
      id: flowStartId,
      name: "リース契約判定",
      description: "この契約書がリース契約に該当するかの判断フロー",
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`フローチャート開始ノードを作成しました: ${flowStart.name}`);

  // Yes分岐の中間ノード
  const yesNode = await prisma.checkList.create({
    data: {
      id: yesNodeId,
      name: "経済的利益の判断",
      description:
        "顧客が使用期間全体を通じて特定された資産の使用から経済的利益のほとんどすべてを享受する権利を有しているか",
      parentId: flowStartId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`フロー中間ノード(Yes分岐)を作成しました: ${yesNode.name}`);

  // No分岐のノード
  const noNode = await prisma.checkList.create({
    data: {
      id: noNodeId,
      name: "特定資産の確認",
      description: "契約に特定された資産が含まれているか再確認",
      parentId: flowStartId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`フロー中間ノード(No分岐)を作成しました: ${noNode.name}`);

  // 結論ノード（リース契約）
  const conclusionYes = await prisma.checkList.create({
    data: {
      id: conclusionYesId,
      name: "リース契約結論",
      description: "当該契約はリースを含む",
      parentId: flowStartId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(
    `フロー結論ノード(リース契約)を作成しました: ${conclusionYes.name}`
  );

  // 結論ノード（非リース契約）
  const conclusionNo = await prisma.checkList.create({
    data: {
      id: conclusionNoId,
      name: "非リース契約結論",
      description: "当該契約はリースを含まない",
      parentId: flowStartId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(
    `フロー結論ノード(非リース契約)を作成しました: ${conclusionNo.name}`
  );

  // 複数選択肢のフローチャート例
  const multiChoiceFlowId = ulid();
  const customerOptionId = ulid();
  const supplierOptionId = ulid();
  const neitherOptionId = ulid();

  // 複数選択肢のフロー開始ノード
  const multiChoiceFlow = await prisma.checkList.create({
    data: {
      id: multiChoiceFlowId,
      name: "使用方法の指図権",
      description:
        "使用期間全体を通じて特定された資産の使用方法を指図する権利を有しているのは誰か",
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`複数選択肢フローノードを作成しました: ${multiChoiceFlow.name}`);

  // 各選択肢の結論ノード
  await prisma.checkList.create({
    data: {
      id: customerOptionId,
      name: "顧客指図権結論",
      description: "顧客が指図権を持つため、リース契約に該当する",
      parentId: multiChoiceFlowId,
      checkListSetId: contractCheckListSetId,
    },
  });

  await prisma.checkList.create({
    data: {
      id: supplierOptionId,
      name: "サプライヤー指図権結論",
      description: "サプライヤーが指図権を持つため、リース契約に該当しない",
      parentId: multiChoiceFlowId,
      checkListSetId: contractCheckListSetId,
    },
  });

  await prisma.checkList.create({
    data: {
      id: neitherOptionId,
      name: "指図権なし結論",
      description: "指図権が明確でないため、追加確認が必要",
      parentId: multiChoiceFlowId,
      checkListSetId: contractCheckListSetId,
    },
  });
  console.log(`複数選択肢の結論ノードを作成しました`);

  // 2. 建築確認申請チェックリストの追加
  console.log("建築確認申請チェックリストの作成を開始します...");

  // チェックリストセットの作成
  const buildingCheckListSetId = ulid();
  const buildingCheckListSet = await prisma.checkListSet.create({
    data: {
      id: buildingCheckListSetId,
      name: "建築確認申請チェックリスト",
      description: "建築確認申請書類の審査用チェックリスト",
    },
  });
  console.log(
    `建築確認申請チェックリストセットを作成しました: ${buildingCheckListSet.name}`
  );

  // 親チェックリスト項目の作成
  const applicantInfoId = ulid();
  const buildingOverviewId = ulid();
  const drawingsId = ulid();
  const legalComplianceId = ulid();

  // 申請者情報
  const applicantInfo = await prisma.checkList.create({
    data: {
      id: applicantInfoId,
      name: "申請者情報",
      description: "申請者の基本情報が正しく記載されているかの確認",
      checkListSetId: buildingCheckListSetId,
    },
  });
  console.log(`親チェックリスト項目を作成しました: ${applicantInfo.name}`);

  // 建築物の概要
  const buildingOverview = await prisma.checkList.create({
    data: {
      id: buildingOverviewId,
      name: "建築物の概要",
      description: "建築物の基本情報が正しく記載されているかの確認",
      checkListSetId: buildingCheckListSetId,
    },
  });
  console.log(`親チェックリスト項目を作成しました: ${buildingOverview.name}`);

  // 図面
  const drawings = await prisma.checkList.create({
    data: {
      id: drawingsId,
      name: "図面",
      description: "必要な図面が添付されているかの確認",
      checkListSetId: buildingCheckListSetId,
    },
  });
  console.log(`親チェックリスト項目を作成しました: ${drawings.name}`);

  // 法適合性
  const legalCompliance = await prisma.checkList.create({
    data: {
      id: legalComplianceId,
      name: "法適合性",
      description: "建築基準法などの法規制に適合しているかの確認",
      checkListSetId: buildingCheckListSetId,
    },
  });
  console.log(`親チェックリスト項目を作成しました: ${legalCompliance.name}`);

  // 子チェックリスト項目の作成
  // 申請者情報の子項目
  const applicantChildren = [
    { name: "氏名の記載", description: "申請者の氏名が正確に記載されているか" },
    { name: "住所の記載", description: "申請者の住所が正確に記載されているか" },
    {
      name: "連絡先の記載",
      description: "申請者の連絡先が正確に記載されているか",
    },
  ];

  for (const child of applicantChildren) {
    await prisma.checkList.create({
      data: {
        id: ulid(),
        name: child.name,
        description: child.description,
        parentId: applicantInfoId,
        checkListSetId: buildingCheckListSetId,
      },
    });
    console.log(`子チェックリスト項目を作成しました: ${child.name}`);
  }

  // 建築物の概要の子項目
  const buildingChildren = [
    {
      name: "建築場所の記載",
      description: "建築物の所在地が正確に記載されているか",
    },
    { name: "用途の記載", description: "建築物の用途が正確に記載されているか" },
    { name: "構造の記載", description: "建築物の構造が正確に記載されているか" },
    { name: "階数の記載", description: "建築物の階数が正確に記載されているか" },
  ];

  for (const child of buildingChildren) {
    await prisma.checkList.create({
      data: {
        id: ulid(),
        name: child.name,
        description: child.description,
        parentId: buildingOverviewId,
        checkListSetId: buildingCheckListSetId,
      },
    });
    console.log(`子チェックリスト項目を作成しました: ${child.name}`);
  }

  // 図面の子項目
  const drawingChildren = [
    { name: "配置図の添付", description: "建築物の配置図が添付されているか" },
    { name: "平面図の添付", description: "建築物の平面図が添付されているか" },
    { name: "立面図の添付", description: "建築物の立面図が添付されているか" },
  ];

  for (const child of drawingChildren) {
    await prisma.checkList.create({
      data: {
        id: ulid(),
        name: child.name,
        description: child.description,
        parentId: drawingsId,
        checkListSetId: buildingCheckListSetId,
      },
    });
    console.log(`子チェックリスト項目を作成しました: ${child.name}`);
  }

  // 法適合性の子項目
  const legalChildren = [
    {
      name: "用途地域の適合",
      description: "建築物の用途が用途地域の規制に適合しているか",
    },
    {
      name: "建ぺい率の適合",
      description: "建築物の建ぺい率が規制に適合しているか",
    },
    {
      name: "容積率の適合",
      description: "建築物の容積率が規制に適合しているか",
    },
    {
      name: "高さ制限の適合",
      description: "建築物の高さが規制に適合しているか",
    },
  ];

  for (const child of legalChildren) {
    await prisma.checkList.create({
      data: {
        id: ulid(),
        name: child.name,
        description: child.description,
        parentId: legalComplianceId,
        checkListSetId: buildingCheckListSetId,
      },
    });
    console.log(`子チェックリスト項目を作成しました: ${child.name}`);
  }

  // 結論項目の作成
  const conclusionItems = [
    { name: "申請書類の完全性", description: "申請書類が完全に揃っているか" },
    {
      name: "法規制への適合性",
      description: "建築計画が法規制に適合しているか",
    },
  ];

  for (const item of conclusionItems) {
    await prisma.checkList.create({
      data: {
        id: ulid(),
        name: item.name,
        description: item.description,
        checkListSetId: buildingCheckListSetId,
      },
    });
    console.log(`結論チェックリスト項目を作成しました: ${item.name}`);
  }

  // 3. 追加のチェックリストセットを作成（合計12個になるように）
  console.log("追加のチェックリストセットの作成を開始します...");

  const additionalCheckListSets = [
    {
      name: "不動産売買契約書チェックリスト",
      description: "不動産売買契約書の審査用チェックリスト",
    },
    {
      name: "賃貸借契約書チェックリスト",
      description: "賃貸借契約書の審査用チェックリスト",
    },
    {
      name: "業務委託契約書チェックリスト",
      description: "業務委託契約書の審査用チェックリスト",
    },
    {
      name: "秘密保持契約書チェックリスト",
      description: "秘密保持契約書の審査用チェックリスト",
    },
    {
      name: "ライセンス契約書チェックリスト",
      description: "ライセンス契約書の審査用チェックリスト",
    },
    {
      name: "販売代理店契約書チェックリスト",
      description: "販売代理店契約書の審査用チェックリスト",
    },
    {
      name: "雇用契約書チェックリスト",
      description: "雇用契約書の審査用チェックリスト",
    },
    {
      name: "保険契約書チェックリスト",
      description: "保険契約書の審査用チェックリスト",
    },
    {
      name: "融資契約書チェックリスト",
      description: "融資契約書の審査用チェックリスト",
    },
    {
      name: "M&A契約書チェックリスト",
      description: "M&A契約書の審査用チェックリスト",
    },
  ];

  const createdCheckListSets = [contractCheckListSetId, buildingCheckListSetId];

  for (const setData of additionalCheckListSets) {
    const setId = ulid();
    const checkListSet = await prisma.checkListSet.create({
      data: {
        id: setId,
        name: setData.name,
        description: setData.description,
      },
    });
    createdCheckListSets.push(setId);
    console.log(`追加チェックリストセットを作成しました: ${checkListSet.name}`);

    // 各セットに基本的なチェック項目を追加
    const basicCheckItems = [
      {
        name: "契約当事者の確認",
        description: "契約当事者が正確に記載されているか",
      },
      {
        name: "契約期間の確認",
        description: "契約期間が明確に記載されているか",
      },
      { name: "対価の確認", description: "対価・報酬が明確に記載されているか" },
      {
        name: "解除条件の確認",
        description: "契約解除の条件が適切に記載されているか",
      },
      {
        name: "準拠法の確認",
        description: "準拠法・管轄裁判所が記載されているか",
      },
    ];

    for (const item of basicCheckItems) {
      await prisma.checkList.create({
        data: {
          id: ulid(),
          name: item.name,
          description: item.description,
          checkListSetId: setId,
        },
      });
    }
  }

  // 4. Review関連データの追加（12個のReviewJobを作成）
  console.log("Review関連データの作成を開始します...");

  const reviewJobNames = [
    "建築確認申請書審査",
    "不動産売買契約書審査",
    "賃貸借契約書審査",
    "業務委託契約書審査",
    "秘密保持契約書審査",
    "ライセンス契約書審査",
    "販売代理店契約書審査",
    "雇用契約書審査",
    "保険契約書審査",
    "融資契約書審査",
    "M&A契約書審査",
    "基本契約書審査",
  ];

  const reviewStatuses = ["pending", "in_progress", "completed", "failed"];
  const createdReviewJobs = [];

  for (let i = 0; i < reviewJobNames.length; i++) {
    const reviewJobId = ulid();
    const checkListSetId =
      createdCheckListSets[i % createdCheckListSets.length];
    const status =
      reviewStatuses[Math.floor(Math.random() * reviewStatuses.length)];

    // 作成日時を少しずつずらす
    const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000); // i日前

    const reviewJob = await prisma.reviewJob.create({
      data: {
        id: reviewJobId,
        name: reviewJobNames[i],
        status,
        checkListSetId,
        createdAt,
        updatedAt: createdAt,
        userId: "user123",
      },
    });
    createdReviewJobs.push(reviewJobId);
    console.log(`ReviewJobを作成しました: ${reviewJob.name}`);

    // ReviewDocument（審査対象ドキュメント）の作成
    const reviewDocumentId = ulid();
    const filename = `${reviewJobNames[i].replace("審査", "")}_サンプル.pdf`;
    const reviewDocument = await prisma.reviewDocument.create({
      data: {
        id: reviewDocumentId,
        filename,
        s3Path: `review-documents/${filename.replace(".pdf", "").toLowerCase()}.pdf`,
        fileType: "application/pdf",
        uploadDate: createdAt,
        userId: "user123",
        status: "uploaded",
        reviewJobId: reviewJobId,
      },
    });
    console.log(`ReviewDocumentを作成しました: ${reviewDocument.filename}`);
  }

  // 最初のReviewJobに詳細なReviewResultを作成（既存のロジックを使用）
  const firstReviewJobId = createdReviewJobs[0];

  // 建築確認申請チェックリストの全項目を取得
  const allBuildingCheckItems = await prisma.checkList.findMany({
    where: {
      checkListSetId: buildingCheckListSetId,
    },
  });

  // ReviewResult（審査結果）の作成をより実践的なデータで強化
  const resultStatuses = ["pass", "fail", "warning", "pending"];
  const confidenceScores = [0.98, 0.85, 0.76, 0.92, 0.65];
  const extractedTexts = [
    ["申請者：山田太郎、東京都渋谷区〇〇1-2-3"],
    ["建築場所：東京都新宿区××4-5-6"],
    ["用途：事務所兼住宅"],
    ["構造：鉄筋コンクリート造 地上5階"],
    ["建築面積：250.5㎡、延床面積：1250.8㎡"],
  ];
  const explanations = [
    "申請者情報が正確に記載されています。",
    "必要書類が不足しています。平面図の添付がありません。",
    "容積率計算に誤りがあります。再確認が必要です。",
    "高さ制限に適合しています。",
    "用途地域（第一種住居地域）における事務所床面積の制限を超過している可能性があります。",
  ];

  for (const checkItem of allBuildingCheckItems) {
    // 特定のチェック項目には詳細な結果を設定
    const isCompleted = Math.random() > 0.3; // 70%は完了状態
    const status = isCompleted ? "completed" : "pending";

    // 結果を生成（completedの場合のみ）
    let result = null;
    let confidenceScore = null;
    let explanation = null;
    let extractedText: string[] | null = null;
    let userOverride = false;
    let userComment = null;

    if (isCompleted) {
      result = resultStatuses[Math.floor(Math.random() * 3)]; // pass, fail, warning
      confidenceScore =
        confidenceScores[Math.floor(Math.random() * confidenceScores.length)];

      // 特定のチェック項目には有意義なデータを設定
      if (checkItem.name.includes("氏名") || checkItem.name.includes("住所")) {
        extractedText = extractedTexts[0];
        explanation = explanations[0];
        result = "pass";
      } else if (checkItem.name.includes("平面図")) {
        extractedText = ["平面図の添付なし"];
        explanation = explanations[1];
        result = "fail";
        // ユーザーによる上書きの例
        userOverride = Math.random() > 0.7;
        if (userOverride) {
          userComment = "確認済み。後日提出予定とのこと。";
        }
      } else if (checkItem.name.includes("容積率")) {
        extractedText = ["容積率：250%（許容：200%）"];
        explanation = explanations[2];
        result = "warning";
      } else if (Math.random() > 0.7) {
        // その他のアイテムにもランダムでデータを設定
        const randomIndex = Math.floor(Math.random() * extractedTexts.length);
        extractedText = extractedTexts[randomIndex];
        explanation =
          explanations[Math.floor(Math.random() * explanations.length)];
      }
    }

    // shortExplanationを追加
    let shortExplanation = null;
    if (explanation) {
      // 説明文から短い説明を生成（80文字以内）
      shortExplanation =
        explanation.length > 80
          ? explanation.substring(0, 77) + "..."
          : explanation;
    }

    // 料金情報を生成（完了状態の場合のみ）
    let reviewMeta: any = Prisma.JsonNull;
    let inputTokens = null;
    let outputTokens = null;
    let totalCost = null;

    if (isCompleted) {
      // 実際のトークン使用量を模擬
      inputTokens = Math.floor(Math.random() * 3000) + 1000; // 1000〜4000
      outputTokens = Math.floor(Math.random() * 1000) + 500; // 500〜1500

      // コストを計算（Sonnetの料金に基づく概算）
      const inputCost = (inputTokens / 1000) * 0.003;
      const outputCost = (outputTokens / 1000) * 0.015;
      totalCost = inputCost + outputCost;

      reviewMeta = {
        model_id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: totalCost,
        pricing: {
          input_per_1k: 0.003,
          output_per_1k: 0.015,
        },
        duration_seconds: Math.floor(Math.random() * 10) + 5, // 5〜15秒
        timestamp: new Date().toISOString(),
      };
    }

    await prisma.reviewResult.create({
      data: {
        id: ulid(),
        reviewJobId: firstReviewJobId,
        checkId: checkItem.id,
        status,
        result,
        confidenceScore,
        explanation,
        shortExplanation,
        extractedText: extractedText
          ? JSON.stringify(extractedText)
          : undefined,
        userOverride,
        userComment,
        // 料金情報を追加
        reviewMeta,
        inputTokens,
        outputTokens,
        totalCost,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
  console.log(
    `ReviewResultを作成しました: ${allBuildingCheckItems.length}件（実際のデータを含む）`
  );

  // 5. プロンプトテンプレートの追加
  console.log("プロンプトテンプレートの作成を開始します...");

  // デフォルトのチェックリスト用プロンプトテンプレート
  const defaultChecklistPrompt = await prisma.promptTemplate.create({
    data: {
      id: ulid(),
      userId: "user123",
      name: "デフォルトチェックリストプロンプト",
      description: "チェックリスト生成のためのデフォルトプロンプト",
      prompt: `あなたは法律文書の分析エキスパートです。
以下の文書を分析し、指定されたチェックリスト項目に基づいて評価してください。

文書: {{document}}

チェックリスト項目:
{{checklist_items}}

各チェックリスト項目について、以下の形式で回答してください:
1. 項目名: [チェックリスト項目名]
2. 評価: [合格/不合格/要確認]
3. 根拠: [文書内の該当部分を引用]
4. 説明: [評価理由の詳細な説明]`,
      type: "checklist",
    },
  });
  console.log(
    `デフォルトチェックリストプロンプトを作成しました: ${defaultChecklistPrompt.name}`
  );

  // カスタムチェックリスト用プロンプトテンプレート
  const customChecklistPrompt = await prisma.promptTemplate.create({
    data: {
      id: ulid(),
      userId: "user123",
      name: "詳細分析チェックリストプロンプト",
      description: "より詳細な分析を行うためのカスタムプロンプト",
      prompt: `あなたは法律文書の詳細分析エキスパートです。
以下の文書を徹底的に分析し、指定されたチェックリスト項目に基づいて詳細な評価を行ってください。

文書: {{document}}

チェックリスト項目:
{{checklist_items}}

各チェックリスト項目について、以下の形式で回答してください:
1. 項目名: [チェックリスト項目名]
2. 評価: [合格/不合格/要確認]
3. 根拠: [文書内の該当部分を引用]
4. 詳細分析: [法的観点からの詳細な分析]
5. リスク評価: [潜在的なリスクの特定と評価]
6. 改善提案: [問題がある場合の具体的な改善提案]`,
      type: "checklist",
    },
  });
  console.log(
    `カスタムチェックリストプロンプトを作成しました: ${customChecklistPrompt.name}`
  );

  // デフォルトのレビュー用プロンプトテンプレート
  const defaultReviewPrompt = await prisma.promptTemplate.create({
    data: {
      id: ulid(),
      userId: "user123",
      name: "デフォルトレビュープロンプト",
      description: "文書レビューのためのデフォルトプロンプト",
      prompt: `あなたは法律文書のレビューエキスパートです。
以下の文書を分析し、指定されたレビュー項目に基づいて評価してください。

文書: {{document}}

レビュー項目:
{{review_items}}

各レビュー項目について、以下の形式で回答してください:
1. 項目名: [レビュー項目名]
2. 評価: [合格/不合格/要確認]
3. 根拠: [文書内の該当部分を引用]
4. 説明: [評価理由の説明]`,
      type: "review",
    },
  });
  console.log(
    `デフォルトレビュープロンプトを作成しました: ${defaultReviewPrompt.name}`
  );

  console.log("シードデータの投入が完了しました");
}

main()
  .catch((e) => {
    console.error("シードデータの投入中にエラーが発生しました:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
