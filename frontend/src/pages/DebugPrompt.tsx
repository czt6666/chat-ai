import { useState, useEffect, useCallback } from 'react'
import { debugLLM } from '../services/api'

const LS_KEY = 'debug_prompt_state'

interface SavedState {
  systemPrompt: string
  userPrompt: string
  provider: 'anthropic' | 'openai'
  model: string
  temperature: number
  maxTokens: number
}

const defaultState: SavedState = {
  systemPrompt: '',
  userPrompt: '',
  provider: 'anthropic',
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
}

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...defaultState, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultState
}

function saveState(state: SavedState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

export default function DebugPrompt() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic')
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'response' | 'request'>('response')

  // Load from localStorage on mount
  useEffect(() => {
    const s = loadState()
    setSystemPrompt(s.systemPrompt)
    setUserPrompt(s.userPrompt)
    setProvider(s.provider)
    setModel(s.model)
    setTemperature(s.temperature)
    setMaxTokens(s.maxTokens)
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    saveState({ systemPrompt, userPrompt, provider, model, temperature, maxTokens })
  }, [systemPrompt, userPrompt, provider, model, temperature, maxTokens])

  const handleSend = useCallback(async () => {
    if (!userPrompt.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await debugLLM({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        provider,
        model: model || undefined,
        temperature,
        max_tokens: maxTokens,
      })
      setResult(res)
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || '请求失败')
    } finally {
      setLoading(false)
    }
  }, [systemPrompt, userPrompt, provider, model, temperature, maxTokens])

  const fillExample = () => {
    setSystemPrompt(`你是一个情感聊天助手，专门用幽默霸道的聊天方式回复消息。`)
    setUserPrompt(`她：今天好累啊，加班到十点\n我：？`)
  }

  const clearAll = () => {
    if (confirm('确定清空所有内容？')) {
      setSystemPrompt('')
      setUserPrompt('')
      setResult(null)
      setError('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-gray-800">🧪 Prompt 调试</h1>
          <div className="flex gap-2">
            <button onClick={fillExample} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              填入示例
            </button>
            <button onClick={clearAll} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded">
              清空
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* System Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">System Prompt</label>
            <span className="text-xs text-gray-400">{systemPrompt.length} 字</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="输入 system prompt（可选）..."
            className="w-full h-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono bg-white resize-y"
          />
        </div>

        {/* User Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">User Prompt</label>
            <span className="text-xs text-gray-400">{userPrompt.length} 字</span>
          </div>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="输入 user prompt（必填）..."
            className="w-full h-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono bg-white resize-y"
          />
        </div>

        {/* Config */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="text-sm font-medium text-gray-700 mb-2">模型配置</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'anthropic' | 'openai')}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI 兼容</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Model（留空用默认）</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Temperature: {temperature}</label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Tokens: {maxTokens}</label>
              <input
                type="range"
                min={256}
                max={4096}
                step={256}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={loading || !userPrompt.trim()}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-300 active:scale-[0.98] transition-transform"
        >
          {loading ? '请求中...' : '发送请求'}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('response')}
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'response' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
              >
                LLM 返回
              </button>
              <button
                onClick={() => setActiveTab('request')}
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'request' ? 'text-blue-600 bg-blue-50' : 'text-gray-500'}`}
              >
                请求详情
              </button>
            </div>

            {/* Response Tab */}
            {activeTab === 'response' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {result.provider} · {result.temperature}T · {result.max_tokens}token · {result.elapsed_ms}ms
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.content)}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                  >
                    复制结果
                  </button>
                </div>
                <pre className="bg-gray-800 text-green-400 rounded-lg p-3 text-sm overflow-x-auto whitespace-pre-wrap max-h-[40rem] overflow-y-auto">
                  {result.content}
                </pre>
              </div>
            )}

            {/* Request Tab */}
            {activeTab === 'request' && (
              <div className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Provider</div>
                  <div className="text-sm text-gray-700 font-mono">{result.provider}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Model</div>
                  <div className="text-sm text-gray-700 font-mono">{result.model}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Temperature / Max Tokens</div>
                  <div className="text-sm text-gray-700 font-mono">{result.temperature} / {result.max_tokens}</div>
                </div>

                {result.system_prompt && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">实际发送的 System Prompt</div>
                    <pre className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                      {result.system_prompt}
                    </pre>
                  </div>
                )}

                <div>
                  <div className="text-xs text-gray-500 mb-1">实际发送的 User Prompt</div>
                  <pre className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                    {result.user_prompt}
                  </pre>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">完整请求 JSON</div>
                  <pre className="bg-gray-800 text-green-400 rounded-lg p-3 text-sm overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono">
                    {JSON.stringify({
                      system_prompt: result.system_prompt,
                      user_prompt: result.user_prompt,
                      provider: result.provider,
                      model: result.model,
                      temperature: result.temperature,
                      max_tokens: result.max_tokens,
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
