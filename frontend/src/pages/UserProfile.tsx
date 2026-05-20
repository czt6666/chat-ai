import { useEffect, useState } from 'react'
import { getUserProfile, updateUserProfile } from '../services/api'

export default function UserProfile() {
  const [profile, setProfile] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const data = await getUserProfile()
      setProfile(data || {})
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserProfile(profile)
      alert('保存成功')
    } catch (e) {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setProfile((prev: any) => ({ ...prev, [field]: value }))
  }

  if (loading) return <div className="p-4 text-center text-gray-400">加载中...</div>

  return (
    <div className="p-4 pb-20">
      <h1 className="text-xl font-bold text-gray-800 mb-4">我的画像</h1>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">昵称</label>
          <input
            type="text"
            value={profile.nickname || ''}
            onChange={(e) => updateField('nickname', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="你的昵称"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">年龄</label>
          <input
            type="number"
            value={profile.age || ''}
            onChange={(e) => updateField('age', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="26"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">职业</label>
          <input
            type="text"
            value={profile.occupation || ''}
            onChange={(e) => updateField('occupation', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="互联网产品经理"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">性格特点</label>
          <textarea
            value={profile.personality || ''}
            onChange={(e) => updateField('personality', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 h-20 resize-none"
            placeholder="偏内向，逻辑型，不太会开玩笑"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">平时聊天风格</label>
          <textarea
            value={profile.chat_style || ''}
            onChange={(e) => updateField('chat_style', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 h-20 resize-none"
            placeholder="直男风，话少，喜欢用句号"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">口头禅（逗号分隔）</label>
          <input
            type="text"
            value={profile.common_phrases || ''}
            onChange={(e) => updateField('common_phrases', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="确实,有道理,哈哈"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-500 mb-1">希望改进的方向</label>
          <textarea
            value={profile.goals || ''}
            onChange={(e) => updateField('goals', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 h-20 resize-none"
            placeholder="学会幽默，敢于推进关系"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium disabled:bg-gray-300"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
