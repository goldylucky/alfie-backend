import dotenv from "dotenv"
dotenv.config()

import candidHealth from "./includes/candidHealth.develop"
import akuteProcedures from "./includes/akuteProcedures.develop"

export default {
  env: "staging",
  dbUri: `mongodb+srv://joinalfie_dev_user:${process.env.DB_PASSWORD}@platform-staging-cluste.zn2qm3z.mongodb.net/?retryWrites=true&w=majority`,
  baseUrl: "https://staging.joinalfie.com",
  easyAppointmentsApiUrl: "https://staging.ea.joinalfie.com/index.php/api/v1",
  sendBirdApiUrl:
    "https://api-D804CA81-FB1D-4078-8A98-B31AE451EAF9.sendbird.com",
  candidHealth: {
    apiUrl: "https://api-staging.joincandidhealth.com/api",
    clientId: process.env.CANDID_CLIENT_ID,
    clientSecret: process.env.CANDID_CLIENT_SECRET,
    serviceTypeCodes: ["90", "3", "30", "BZ"],
    settings: candidHealth,
  },
  withings: {
    apiUrl: "https://wbsapi.withings.net",
    clientId: process.env.WITHINGS_CLIENT_ID,
    clientSecret: process.env.WITHINGS_CLIENT_SECRET,
  },
  dynamoDb: {
    emailSubscribersTable: "staging-platform-email-subscribers",
    waitlistTable: "staging-platform-waitlist",
  },
  s3: {
    patientBucketName: "staging-platform-patient-storage",
    checkoutBucketName: "staging-platform-checkout-storage",
  },
  ringCentral: {
    clientId: "DiUqEh27Rz-fDuQiez1OdQ",
    number: "+19167582408",
    extension: "101",
  },
  akuteApiUrl: "https://api.staging.akutehealth.com/v1",
  akute: {
    labCorpOrganizationId: "f-4f0235627ac2d59b49e5575c", // testinglab facility
    // labCorpOrganizationId: "f-e20f61500ba128d340068ff6", // labcorp
    procedures: akuteProcedures,
  },
  twilioPhone: "+18447440088",
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    defaultPriceId:
      process.env.STRIPE_DEFAULT_PRICE_ID ?? "price_1KMviXDOjl0X0gOq9Pk7gRFE",
    partnerPriceId:
      process.env.STRIPE_PARTNER_PRICE_ID ?? "price_1KMviXDOjl0X0gOq9Pk7gRFE",
  },
}
