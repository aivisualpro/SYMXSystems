// Questions an interviewer can pick from when interviewing a Delivery
// Associate candidate. Not every question is needed for every candidate —
// the interviewer chooses which ones to ask and records answers.
//
// `prefill` names an applicant field (from the public application form) whose
// answer is copied in when the question is first selected.

export interface InterviewQuestion {
  key: string;
  label: string; // short chip text
  question: string; // full question shown to the interviewer
  prefill?: "driverDescription" | "experience";
}

export const DA_INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { key: "valid-dl", label: "Valid DL", question: "Do you have a valid driver's license?" },
  { key: "transportation", label: "Reliable transportation", question: "Do you have reliable transportation to get to work?" },
  {
    key: "amazon-exp",
    label: "Amazon / delivery experience",
    question: "Do you have previous Amazon experience or any other delivery driving experience?",
    prefill: "experience",
  },
  { key: "big-vans", label: "Bigger vans", question: "Do you have any experience driving bigger vans, such as Amazon vans?" },
  {
    key: "physical-job",
    label: "Physically active job",
    question: "Tell me about a previous job where you were physically active throughout your shift.",
  },
  {
    key: "unsure-delivery",
    label: "Unsure how to deliver",
    question: "What would you do if you were unsure how to complete a delivery?",
  },
  {
    key: "describe-driver",
    label: "Describe yourself as a driver",
    question: "How would you describe yourself as a driver?",
    prefill: "driverDescription",
  },
];

export interface InterviewQA {
  key: string;
  question: string;
  answer: string;
}
