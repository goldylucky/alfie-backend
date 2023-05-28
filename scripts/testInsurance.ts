import prepareShellEnvironment from "./utils/prepareShellEnvironment"
import * as candid from "../src/utils/candid"
import { InsuranceEligibilityInput, UserModel } from "../src/schema/user.schema"
import { Provider } from "../src/schema/provider.schema"
import AppointmentService from "../src/services/appointment.service"

console.log("Starting test insurance script.")

async function testInsurance() {
  await prepareShellEnvironment()

  const user = await UserModel.findOne({
    email: "john-paul+user@joinalfie.com",
  }).populate<{ provider: Provider }>("provider")
  user.name = "johnone doeone"
  user.dateOfBirth = new Date("1980-01-02")
  user.address.line1 = "123 address1"
  user.address.line2 = "123"
  user.address.city = "city1"
  user.address.state = "WA"
  user.address.postalCode = "981010000"
  user.phone = "123456789"
  user.email = "email@email.com"

  const { provider } = user
  provider.npi = "1760854442"
  provider.firstName = "johnone"
  provider.lastName = "doetwo"
  // TODO: provider address?

  await candid.authenticate()
  // console.log("saved auth token", JSON.stringify(await candid.getSavedAuthorizationToken()))

  const input: InsuranceEligibilityInput = {
    groupId: "0000000000",
    groupName: "group name",
    memberId: "0000000000",
    payor: "00019", // https://developers.changehealthcare.com/eligibilityandclaims/docs/use-the-test-payers-in-the-sandbox-api
    rxBin: "12345",
    rxGroup: "abcdefg",
    userId: user._id.toString(),
  }

  const eligibility = await candid.checkInsuranceEligibility(
    user,
    provider,
    input,
    "00001"
  )

  console.log("eligibility", JSON.stringify(eligibility))

  const appointmentService = new AppointmentService()
  const appointment = await appointmentService.getAppointment({
    eaAppointmentId: "2",
    timezone: "America/New_York",
  })
  await candid.createCodedEncounter(user, provider, appointment, input)

  process.exit(0)
}

testInsurance().catch((error) => console.error(error))
