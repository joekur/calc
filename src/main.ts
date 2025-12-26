import './style.css'
import { createEditor } from './ui/createEditor'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app')

app.append(
  createEditor({
    initialValue: '2 + 2\n# comments are ignored later\n',
    autofocus: true
  })
)

