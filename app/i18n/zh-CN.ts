export const zhCN = {
  common: {
    backToTests: "返回测试列表",
    start: "开始测试",
    startNow: "开始测试",
    previous: "上一题",
    next: "下一题",
    submit: "查看结果",
    viewLastResult: "查看上次结果",
    retake: "重新测试",
    loadingAssessment: "正在加载测试...",
    loadingResult: "正在生成你的结果...",
    testNotFound: "没有找到这个测试",
    resultUnavailable: "暂时无法生成结果，请重新测试。",
    invalidRoute: "页面不存在，先回到测试列表看看吧。"
  },
  homepage: {
    featured: "精选测试",
    allTests: "全部测试",
    questionCount: "{count} 题",
    minutes: "约 {minutes} 分钟",
    allCategories: "全部",
    openTest: "查看测试"
  },
  runner: {
    progress: "第 {current} / {total} 题",
    progressLabel: "答题进度",
    selected: "已选择"
  },
  result: {
    assessmentLabel: "测试结果",
    defaultHeroTitle: "你的结果",
    match: "匹配",
    percentMatch: "{score}% 匹配",
    alsoCloseTo: "也接近 {title}",
    profileShape: "你的性格画像",
    bestMatches: "最匹配你的结果",
    dimensions: "你的特质维度",
    atAGlance: "你的关键词",
    strengths: "你的优势",
    weaknesses: "值得留意",
    quadrant: "你的当前位置",
    highlights: "结果亮点",
    noRankings: "暂时没有可展示的匹配排序。",
    noOptionalContent: "这部分内容暂时不可用。",
    radarAlt: "展示各项特质分数的雷达图",
    dimensionScore: "{label}：{score} / {max}",
    quadrantAlt: "{xLabel} {xScore} 分，{yLabel} {yScore} 分",
    quadrantText: "{xLabel}：{xScore}。{yLabel}：{yScore}。",
    lowDimension: "低 {label}",
    highDimension: "高 {label}",
    primaryResult: "主要结果",
    topRanking: "最佳匹配",
    highDimensions: "高分维度"
  },
  share: {
    title: "分享结果",
    snapshot: "生成你的分享卡",
    layoutLabel: "分享卡比例",
    defaultHeadline: "我的测试结果",
    fallbackTitle: "结果已生成",
    fallbackSubtitle: "这是一张简洁的结果分享卡。",
    defaultBranding: "轻测一下",
    exportPng: "保存结果图",
    rendering: "正在生成图片...",
    exported: "图片已保存。",
    exportFailed: "图片保存失败，请稍后再试。",
    qrFailed: "二维码生成失败，分享卡仍可保存。",
    qrAlt: "打开测试详情页的二维码",
    match: "匹配"
  },
  compatibility: {
    title: "匹配结果",
    selectorTitle: "看看你和谁更合拍",
    selectorLabel: "选择一个类型",
    selectorPlaceholder: "选择一个类型",
    resetSelection: "重新选择",
    inviteButton: "邀请 TA 测一测",
    inviteHint: "完成测试，看看你们的匹配结果",
    inviteCta: "一起测测看",
    sourceLabel: "你的类型",
    targetLabel: "TA 的类型",
    overallScore: "整体匹配度",
    dimensions: "关系维度",
    strengths: "你们的优势",
    frictionPoints: "需要磨合",
    advice: "相处建议",
    summary: "关系总结",
    missing: "暂时没有可展示的匹配结果。",
    shareTitle: "分享匹配结果",
    shareHeadline: "我们的匹配结果",
    shareQrPrompt: "测测你们有多合拍",
    pairJoiner: "＋",
    scoreAlt: "{score}% 整体匹配度"
  },
  categories: {
    all: "全部",
    personality: "人格",
    love: "恋爱",
    career: "职业",
    interest: "趣味",
    city: "城市",
    literature: "文学",
    trending: "热门"
  }
} as const;

export type ProductCopy = typeof zhCN;

export function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (copy, [key, value]) => copy.split(`{${key}}`).join(String(value)),
    template
  );
}
