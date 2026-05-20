import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listGirls, createGirl } from '../services/api'

interface Girl {
  girl_id: string
  name: string
  stage: string
  tags: string[]
  notes: string
}

export default function Home() {
  const [girls, setGirls] = useState<Girl[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGirls()
  }, [])

  const loadGirls = async () => {
    try {
      const res = await listGirls()
      setGirls(res.girls || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createGirl({ name: newName.trim(), stage: '刚加' })
      setNewName('')
      setShowCreate(false)
      loadGirls()
    } catch (e) {
      alert('创建失败')
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">AiChat Agent</h1>

      {loading ? (
        <div className="text-center text-gray-400 py-10">加载中...</div>
      ) : girls.length === 0 ? (
        <div className="text-center text-gray-400 py-10">
          还没有女生档案
          <br />
          点击右下角 + 创建一个
        </div>
      ) : (
        <div className="space-y-3">
          {girls.map((girl) => (
            <Link
              key={girl.girl_id}
              to={`/girls/${girl.girl_id}/chat`}
              className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 active:scale-95 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {girl.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{girl.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${stageColor(girl.stage)}`}>
                        {girl.stage}
                      </span>
                      {girl.tags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs text-gray-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 新建女生弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">新建女生档案</h3>
            <input
              type="text"
              placeholder="她的名字"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-600"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 悬浮新建按钮 */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white text-2xl active:scale-90 transition-transform z-40"
      >
        +
      </button>
    </div>
  )
}
