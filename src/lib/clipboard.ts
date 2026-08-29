// 剪贴板写入：优先 Clipboard API（secure context），失败/不可用时回退 execCommand('copy')。
// 该模块是纯工具，便于单测（可用 jsdom + 注入 navigator.clipboard 模拟）。

export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'clipboard' in navigator && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 权限被拒或非安全上下文抛错，走 legacy 回退
    }
  }
  return legacyCopyText(text)
}

function legacyCopyText(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    textarea.remove()
  }
  return ok
}
