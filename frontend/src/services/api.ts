import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 用户画像
export const getUserProfile = () => api.get('/user/profile').then(r => r.data)
export const updateUserProfile = (data: any) => api.put('/user/profile', data).then(r => r.data)

// 女生管理
export const listGirls = () => api.get('/girls').then(r => r.data)
export const createGirl = (data: any) => api.post('/girls', data).then(r => r.data)
export const getGirl = (girlId: string) => api.get(`/girls/${girlId}`).then(r => r.data)
export const updateGirl = (girlId: string, data: any) => api.put(`/girls/${girlId}`, data).then(r => r.data)
export const deleteGirl = (girlId: string) => api.delete(`/girls/${girlId}`).then(r => r.data)

// 聊天
export const sendChat = (girlId: string, image: File, textNote: string = '') => {
  const formData = new FormData()
  formData.append('image', image)
  if (textNote) formData.append('text_note', textNote)
  return api.post(`/girls/${girlId}/chat`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
