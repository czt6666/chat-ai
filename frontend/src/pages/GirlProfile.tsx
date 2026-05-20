import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGirl, updateGirl, deleteGirl } from '../services/api'

export default function GirlProfile() {
  const { girlId } = useParams()
  const navigate = useNavigate()
  const [girl, setGirl] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadGirl()
  }, [girlId])

  const loadGirl = async () => {
    if (!girlId) return
    try {
      const data = await getGirl(girlId)
      setGirl(data)
    } catch (e) {
      alert('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setGirl((prev: any) => ({ ...prev, [field]: value }))
  }

  const updateListField = (field: string, value: string) => {
    // 逗号分隔的字符串转数组
    const arr = value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    setGirl((prev: any) => ({ ...prev, [field]: arr }))
  }

  const handleSave = async () => {
    if (!girlId) return
    setSaving(true)
    try {
      await updateGirl(girlId, {
        name: girl.name,
        age: girl.age ? parseInt(girl.age) : null,
        occupation: girl.occupation,
        source: girl.source,
        stage: girl.stage,
        tags: girl.tags,
        likes: girl.likes,
        taboos: girl.taboos,
        notes: girl.notes,
      })
      alert('保存成功')
    } catch (e) {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!girlId) return
    if (!confirm(`确定要删除 ${girl?.name} 的所有数据吗？此操作不可恢复。`)) return
    try {
      await deleteGirl(girlId)
      navigate('/')
    } catch (e) {
      alert('删除失败')
    }
  }

  if (loading) return <div className="p-4 text-center text-gray-400">加载中...</div>
  if (!girl) return <div className="p-4 text-center text-gray-400">女生不存在</div>

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="text-gray-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800">{girl.name} 的档案</h1>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">名字 *</label>
          <input
            type="text"
            value={girl.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">年龄</label>
            <input
              type="number"
              value={girl.age || ''}
              onChange={(e) => updateField('age', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="24"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">关系阶段</label>
            <select
              value={girl.stage || '刚加'}
              onChange={(e) => updateField('stage', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="刚加">刚加</option>
              <option value="熟悉期">熟悉期</option>
              <option value="暧昧期">暧昧期</option>
              <option value="即将确定关系">即将确定关系</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">职业</label>
            <input
              type="text"
              value={girl.occupation || ''}
              onChange={(e) => updateField('occupation', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="设计师"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">认识渠道</label>
            <input
              type="text"
              value={girl.source || ''}
              onChange={(e) => updateField('source', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="探探/微信/抖音"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">性格标签（逗号分隔）</label>
          <input
            type="text"
            value={(girl.tags || []).join(', ')}
            onChange={(e) => updateListField('tags', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="猫系, 慢热, 事业心强"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">兴趣爱好（逗号分隔）</label>
          <input
            type="text"
            value={(girl.likes || []).join(', ')}
            onChange={(e) => updateListField('likes', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="猫, 咖啡, 看展"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">雷区（逗号分隔）</label>
          <input
            type="text"
            value={(girl.taboos || []).join(', ')}
            onChange={(e) => updateListField('taboos', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="被说教, 查岗, 太油腻"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">关键记忆 / 备注</label>
          <textarea
            value={girl.notes || ''}
            onChange={(e) => updateField('notes', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 h-24 resize-none"
            placeholder="5/18约看展她说看安排，态度犹豫。不喜欢太正式的邀约。"
          />
          <div className="text-xs text-gray-400 mt-1">
            这些备注会在每次生成回复时注入AI，是你的秘密武器
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-300"
        >
          {saving ? '保存中...' : '保存档案'}
        </button>

        <button
          onClick={handleDelete}
          className="w-full py-3 rounded-lg border border-red-200 text-red-500 font-medium"
        >
          删除此档案
        </button>
      </div>
    </div>
  )
}
