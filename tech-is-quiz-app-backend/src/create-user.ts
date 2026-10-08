import "dotenv/config"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { createUser, loadUsers, type UserRole } from "./auth.js"

function readPassword(label: string) {
  if (!stdin.isTTY) {
    const prompt = createInterface({ input: stdin, output: stdout })
    return prompt.question(label).finally(() => prompt.close())
  }
  stdout.write(label)
  stdin.setRawMode(true)
  stdin.resume()
  return new Promise<string>((resolve, reject) => {
    let password = ""
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish()
          reject(new Error("Account creation cancelled."))
          return
        }
        if (character === "\r" || character === "\n") {
          finish()
          stdout.write("\n")
          resolve(password)
          return
        }
        if (character === "\u007f" || character === "\b") password = password.slice(0, -1)
        else password += character
      }
    }
    const finish = () => {
      stdin.off("data", onData)
      stdin.setRawMode(false)
      stdin.pause()
    }
    stdin.on("data", onData)
  })
}

const args = process.argv.slice(2)
const normalizedArgs = args[0] === "--" ? args.slice(1) : args
const [email, name, roleArgument] = normalizedArgs
if (!email || !name || !roleArgument) {
  console.error('Usage: pnpm create-user -- "email" "display name" ADMIN|PARTICIPANT')
  process.exit(1)
}

const role = roleArgument.toUpperCase() as UserRole
try {
  await loadUsers()
  const password = await readPassword("Password (minimum 12 characters, input hidden): ")
  const confirmation = await readPassword("Confirm password: ")
  if (password !== confirmation) throw new Error("Passwords do not match.")
  const user = await createUser(email, name, role, password)
  console.log(`Created ${user.role} account for ${user.email}.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not create account.")
  process.exitCode = 1
}