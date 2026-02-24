import { redirect } from 'next/navigation'

// R8.3: "Insights" renamed to "Monthly Review"
export default function InsightsRedirect() {
  redirect('/monthly-review')
}
