import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getGirl, sendChat } from '../services/api'

interface ParsedResult {
  chat_messages: { role: string; content: string }[]
  emotion_analysis: string
  detected_scenes: string[]
  meta: any
}

const SCENE_NAMES: Record<string, string> = {
  s01: '女生冷淡敷衍',
  s02: '女生说累了',
  s03: '女生不主动发消息',
  s04: '推进暧昧关系',
  s05: '冷读破冰',
  s06: '索取型女人识别',
}

export default function Chat() {
  const { girlId } = useParams()
  const navigate = useNavigate()
  const [girl, setGirl] = useState<any>(null)
  const [loadingGirl, setLoadingGirl] = useState(true)

  // 聊天状态
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textNote, setTextNote] = useState('')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [reply, setReply] = useState<any>(null)
  const [step, setStep] = useState<'idle' | 'uploading' | 'parsing' | 'generating' | 'done'>('idle')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadGirl()
  }, [girlId])

  // 清理预览URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const loadGirl = async () => {
    if (!girlId) return
    try {
      const data = await getGirl(girlId)
      setGirl(data)
    } catch (e) {
      alert('加载女生档案失败')
    } finally {
      setLoadingGirl(false)
    }
  }

  const startTimer = () => {
    setElapsedTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) return
    setSelectedImage(file)
    setPreviewUrl(URL.createObjectURL(file))
    setParsed(null)
    setReply(null)
    setStep('idle')
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  // 拖拽上传
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file)
    }
  }, [])

  const handleSubmit = async () => {
    if (!girlId || !selectedImage) return

    setStep('uploading')
    startTimer()

    try {
      setStep('parsing')
      const res = await sendChat(girlId, selectedImage, textNote)
      setStep('done')
      setParsed(res.parsed)
      setReply(res)
    } catch (e: any) {
      alert('请求失败: ' + (e.response?.data?.error?.message || e.message))
      setStep('idle')
    } finally {
      stopTimer()
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('已复制到剪贴板')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('已复制到剪贴板')
    }
  }

  const stageColor = (stage: string) => {
    const map: Record<string, string> = {
      '刚加': 'bg-gray-100 text-gray-600',
      '熟悉期': 'bg-blue-100 text-blue-600',
      '暧昧期': 'bg-pink-100 text-pink-600',
      '即将确定关系': 'bg-red-100 text-red-600',
    }
    return map[stage] || 'bg-gray-100 text-gray-600'
  }

  const emotionColor = (emotion: string) => {
    if (emotion.includes('求安慰') || emotion.includes('撒娇')) return 'bg-pink-100 text-pink-700'
    if (emotion.includes('测试') || emotion.includes('刁难')) return 'bg-red-100 text-red-700'
    if (emotion.includes('冷淡') || emotion.includes('敷衍')) return 'bg-gray-100 text-gray-700'
    if (emotion.includes('生气') || emotion.includes('烦')) return 'bg-purple-100 text-purple-700'
    if (emotion.includes('窗口') || emotion.includes('暧昧')) return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }

  // Markdown 文本渲染（保留换行+简单格式）
  const MdText = ({ text, className = '' }: { text: string; className?: string }) => (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown>{text || ''}</ReactMarkdown>
    </div>
  )

  // 纯文本保留换行
  const PlainText = ({ text, className = '' }: { text: string; className?: string }) => (
    <div className={`whitespace-pre-wrap ${className}`}>{text}</div>
  )

  // 格式化 JSON 或纯文本展示
  const FormattedRaw = ({ text }: { text: string }) => {
    let formatted = text
    let isJson = false
    try {
      // 尝试提取并格式化 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        formatted = JSON.stringify(parsed, null, 2)
        isJson = true
      }
    } catch {
      // 不是 JSON，保持原样
    }

    return (
      <pre className={`rounded-lg p-3 text-sm overflow-x-auto whitespace-pre-wrap max-h-[32rem] overflow-y-auto ${isJson ? 'bg-gray-800 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
        {formatted}
      </pre>
    )
  }

  if (loadingGirl) return <div className="p-4 text-center text-gray-400">加载中...</div>
  if (!girl) return <div className="p-4 text-center text-gray-400">女生不存在</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部栏 */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="text-gray-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="font-semibold text-gray-800">{girl.name}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(girl.stage)}`}>
              {girl.stage}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 对话历史 */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-2 py-1 rounded ${showHistory ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}
            title="对话历史"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {/* 调试开关 */}
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`text-xs px-2 py-1 rounded ${showDebug ? 'bg-purple-100 text-purple-700' : 'text-gray-400'}`}
          >
            🐛
          </button>
          <Link to={`/girls/${girlId}/profile`} className="text-gray-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-20">
        {/* 上传区域（支持拖拽） */}
        {!parsed && (
          <div
            ref={dropZoneRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-colors ${
              isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-100'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onFileInputChange}
              className="hidden"
            />

            {!selectedImage ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center gap-2 text-gray-400 active:border-blue-400 active:text-blue-500"
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">点击拍照、选择截图，或拖拽到此处</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <img
                    src={previewUrl || ''}
                    alt="selected"
                    className="w-full rounded-lg max-h-64 object-contain bg-gray-100"
                  />
                  <button
                    onClick={() => { setSelectedImage(null); setPreviewUrl(null); setParsed(null); setReply(null); }}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center text-sm"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={textNote}
                  onChange={(e) => setTextNote(e.target.value)}
                  placeholder="备注：她前面还发了什么？（可选）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSubmit}
                  disabled={step === 'uploading' || step === 'parsing'}
                  className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-300"
                >
                  {step === 'idle' && '开始分析'}
                  {step === 'uploading' && `上传中... 已等待 ${elapsedTime} 秒`}
                  {step === 'parsing' && `AI分析中... 已等待 ${elapsedTime} 秒`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 解析结果 */}
        {parsed && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">📋 解析结果</h3>
              <button
                onClick={() => { setParsed(null); setReply(null); setSelectedImage(null); setPreviewUrl(null); setStep('idle'); }}
                className="text-xs text-blue-600"
              >
                重新上传
              </button>
            </div>

            {/* 情绪标签 */}
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${emotionColor(parsed.emotion_analysis)}`}>
              {parsed.emotion_analysis || '未知情绪'}
            </div>

            {/* 识别到的场景 */}
            {parsed.detected_scenes?.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-xs text-gray-400">识别场景：</span>
                {parsed.detected_scenes.map((tag: string) => (
                  <span key={tag} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    {SCENE_NAMES[tag] || tag}
                  </span>
                ))}
              </div>
            )}

            {/* [暂不启用] 女生档案更新 */}
            {/* {parsed.girl_summary && (
              <div className="mb-3 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium mb-1">AI观察总结（已自动更新档案）</div>
                <div className="text-xs text-green-700">{parsed.girl_summary}</div>
              </div>
            )} */}

            {/* 聊天内容 */}
            {parsed.chat_messages?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">💬 聊天内容：</div>
                <div className="space-y-1">
                  {parsed.chat_messages.map((m, i) => (
                    <div key={i} className={`rounded-lg px-3 py-2 text-sm ${
                      m.role === 'her' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      <span className="text-xs font-medium opacity-60 mr-1">{m.role === 'her' ? '她' : '我'}：</span>
                      <MdText text={m.content} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 元信息 */}
            {parsed.meta?.overall_tone && (
              <div className="text-xs text-gray-400">
                氛围：{parsed.meta.overall_tone} · 间隔：{parsed.meta.reply_gap || '未知'}
              </div>
            )}

            {/* 降级警告 */}
            {parsed.meta?.warning && (
              <div className="mt-2 text-xs bg-yellow-50 text-yellow-700 px-3 py-2 rounded-lg">
                ⚠️ {parsed.meta.warning}
              </div>
            )}
          </div>
        )}

        {/* 回复结果 */}
        {reply && (
          <div className="space-y-3">
            {/* 思路 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-xs text-gray-400 mb-2">💡 窗口分析</div>
              <MdText text={reply.window_analysis} className="text-sm text-gray-600 mb-3" />
              <div className="text-xs text-gray-400 mb-2">🎯 回复策略</div>
              <MdText text={reply.reply_strategy} className="text-sm text-gray-600" />
            </div>

            {/* 平衡版（推荐） */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 shadow-sm border-2 border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-blue-700">⭐ 平衡版（推荐）</span>
                <button
                  onClick={() => copyToClipboard(reply.versions.balanced)}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full active:scale-95"
                >
                  复制
                </button>
              </div>
              <PlainText text={reply.versions.balanced} className="text-gray-800 font-medium" />
            </div>

            {/* 保守版 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">🤔 保守版</span>
                <button
                  onClick={() => copyToClipboard(reply.versions.conservative)}
                  className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full active:scale-95"
                >
                  复制
                </button>
              </div>
              <PlainText text={reply.versions.conservative} className="text-gray-600" />
            </div>

            {/* 激进版 */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500">🔥 激进版</span>
                <button
                  onClick={() => copyToClipboard(reply.versions.aggressive)}
                  className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full active:scale-95"
                >
                  复制
                </button>
              </div>
              <PlainText text={reply.versions.aggressive} className="text-gray-600" />
            </div>

            {/* 推荐原因 */}
            {reply.why && (
              <div className="text-xs text-gray-400 px-2">
                推荐原因：{reply.why}
              </div>
            )}
          </div>
        )}

        {/* 对话历史面板 */}
        {showHistory && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">💬 当前对话</h3>
              <button
                onClick={() => {
                  if (confirm('新建对话后，当前对话历史将保留，但新消息会进入新会话。确定吗？')) {
                    fetch(`${import.meta.env.VITE_API_BASE || '/api'}/girls/${girlId}/sessions/new`, { method: 'POST' })
                      .then(() => alert('新建对话成功'))
                      .catch(() => alert('新建对话失败'))
                  }
                }}
                className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full"
              >
                + 新建对话
              </button>
            </div>
            <div className="text-xs text-gray-400">
              多轮对话历史已接入，AI 会根据上下文生成更连贯的回复。
            </div>
          </div>
        )}

        {/* 调试面板 */}
        {showDebug && reply?.debug && (
          <div className="bg-gray-900 rounded-xl p-4 text-sm">
            <h3 className="font-bold text-gray-300 mb-3">🐛 调试信息</h3>

            {/* 思考步骤 */}
            <div className="mb-4">
              <div className="text-gray-500 mb-2">思考步骤：</div>
              <div className="space-y-2">
                {reply.debug.steps?.map((s: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      s.status === 'done' ? 'bg-green-500' : s.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <span className="text-gray-300">{s.name}</span>
                      <span className="text-gray-500 ml-2">{s.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Prompt */}
            {reply.debug.system_prompt && (
              <div className="mb-4">
                <div className="text-gray-500 mb-2">System Prompt：</div>
                <pre className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {reply.debug.system_prompt}
                </pre>
              </div>
            )}

            {/* 发送给LLM的完整Prompt */}
            {reply.debug.full_prompt && (
              <div className="mb-4">
                <div className="text-gray-500 mb-2">发送给LLM的完整Prompt：</div>
                <pre className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {reply.debug.full_prompt}
                </pre>
              </div>
            )}

            {/* LLM原始返回 */}
            {reply.debug.raw_response && (
              <div className="mb-4">
                <div className="text-gray-500 mb-2">LLM原始返回 {reply.debug.raw_response.includes('{') ? '（已格式化JSON）' : '（非JSON格式）'}：</div>
                <FormattedRaw text={reply.debug.raw_response} />
              </div>
            )}

            {/* 识图调试信息 */}
            {reply.parse_debug && (
              <div className="mb-4 border-t border-gray-700 pt-4">
                <div className="text-purple-400 font-medium mb-2">🖼️ 识图调试信息</div>
                {reply.parse_debug.system_prompt && (
                  <div className="mb-3">
                    <div className="text-gray-500 mb-1">识图 System Prompt：</div>
                    <pre className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {reply.parse_debug.system_prompt}
                    </pre>
                  </div>
                )}
                {reply.parse_debug.user_prompt && (
                  <div className="mb-3">
                    <div className="text-gray-500 mb-1">识图 User Prompt：</div>
                    <pre className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {reply.parse_debug.user_prompt}
                    </pre>
                  </div>
                )}
                {reply.parse_debug.raw_response && (
                  <div className="mb-3">
                    <div className="text-gray-500 mb-1">识图 LLM 原始返回：</div>
                    <FormattedRaw text={reply.parse_debug.raw_response} />
                  </div>
                )}
              </div>
            )}

            {/* JSON 解析失败原因说明 */}
            {(parsed?.meta?.warning || parsed?.meta?.error) && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                <div className="text-yellow-500 font-medium mb-1">JSON 解析失败的可能原因：</div>
                <ul className="text-xs text-yellow-400/80 space-y-1 list-disc list-inside">
                  <li>LLM 在 JSON 前后加了解释文字（如"好的，这是结果：..."）</li>
                  <li>LLM 返回了 markdown 代码块（```json ... ```）而不是纯 JSON</li>
                  <li>LLM 输出的 JSON 格式不合法（缺少引号、多余逗号）</li>
                  <li>LLM 根本没返回 JSON，而是返回了纯文本描述</li>
                </ul>
                <div className="text-xs text-yellow-500/60 mt-2">
                  截图解析用 GPT-4o，多模态模型的文本指令遵循能力略低于纯文本模型，更容易出现格式问题。已启用三级降级提取，90% 情况可自动修复。
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
