import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import App from './App'
import { STORAGE_KEY, loadStations } from './stations'
it('validates, saves, reloads, edits and swaps stations', async () => {
  const user = userEvent.setup()
  const view = render(<App />)
  await user.click(screen.getByRole('button', { name: '保存してはじめる' }))
  expect(screen.getByRole('alert')).toHaveTextContent('両方入力')
  await user.type(screen.getByLabelText('最寄り駅'), '東京')
  await user.type(screen.getByLabelText('目的地駅'), '東京')
  await user.click(screen.getByRole('button', { name: '保存してはじめる' }))
  expect(screen.getByRole('alert')).toHaveTextContent('同じ駅')
  await user.clear(screen.getByLabelText('目的地駅'))
  await user.type(screen.getByLabelText('目的地駅'), '新宿')
  await user.click(screen.getByRole('button', { name: '保存してはじめる' }))
  expect(loadStations().stations).toEqual({ nearby: '東京', destination: '新宿' })
  view.unmount(); render(<App />)
  expect(screen.getByRole('button', { name: /目的地へ/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /最寄りへ/ })).toBeVisible()
  await user.click(screen.getByRole('button', { name: '設定を開く' }))
  await user.click(screen.getByRole('button', { name: /駅を入れ替え/ }))
  expect(screen.getByLabelText('最寄り駅')).toHaveValue('新宿')
  await user.click(screen.getByRole('button', { name: '変更を保存' }))
  expect(loadStations().stations).toEqual({ nearby: '新宿', destination: '東京' })
})
it('recovers from corrupt storage', () => {
  localStorage.setItem(STORAGE_KEY, '{broken')
  render(<App />)
  expect(screen.getByRole('alert')).toHaveTextContent('再登録')
})
it('reports failed storage without claiming success', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.type(screen.getByLabelText('最寄り駅'), '東京')
  await user.type(screen.getByLabelText('目的地駅'), '新宿')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(screen.getByRole('button', { name: '保存してはじめる' }))
  expect(screen.getByRole('alert')).toHaveTextContent('保存できません')
  spy.mockRestore()
})
