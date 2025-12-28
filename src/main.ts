import './style.css'
import { createEditor } from './ui/createEditor'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app')

const defaultValue = `# Math expressions
2 + 2
(10 - 3) / 10
4 * 10 ^ 6

# Variables
salary = $120,000
taxRate = 30%
tax = salary * taxRate
net = salary - tax

# Basic functions
max(2, 3)
min(2, 3)
ceil(1.1)
floor(1.1)

# Unit conversions
1 m in cm
1 m + 20 cm
20 sq cm in cm2
1 gal in l
0 c in f

# \`total\` sums all consecutive previous lines
$1
$2
$3 * 3
total
`

app.append(
  createEditor({
    initialValue: defaultValue,
    autofocus: true
  })
)
