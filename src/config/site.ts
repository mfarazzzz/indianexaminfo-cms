export const SITE = {
  name:        "IndianExamInfo CMS",
  version:     "1.0.0",
  frontendUrl: "https://www.indianexaminfo.com",
  cmsUrl:      "https://cms.indianexaminfo.com",
} as const;

// PILLARS constant removed — content domains are database-driven (REQ-001).
// Use the usePillars() hook to load domains at runtime.
// Do NOT add a PILLARS constant back to this file.

export const CONTENT_TYPES = [
  { value: "notification",    label: "Notification"     },
  { value: "application",     label: "Application"      },
  { value: "admit-card",      label: "Admit Card"       },
  { value: "date-sheet",      label: "Date Sheet"       },
  { value: "syllabus",        label: "Syllabus"         },
  { value: "answer-key",      label: "Answer Key"       },
  { value: "result",          label: "Result"           },
  { value: "cutoff",          label: "Cutoff"           },
  { value: "previous-papers", label: "Previous Papers"  },
  { value: "mock-test",       label: "Mock Test"        },
  { value: "study-material",  label: "Study Material"   },
  { value: "books",           label: "Books"            },
] as const;

export const EXAM_STATUSES = [
  { value: "upcoming",             label: "Upcoming"             },
  { value: "active",               label: "Active"               },
  { value: "registration-open",    label: "Registration Open"    },
  { value: "registration-closed",  label: "Registration Closed"  },
  { value: "result-declared",      label: "Result Declared"      },
  { value: "completed",            label: "Completed"            },
  { value: "ongoing",              label: "Ongoing"              },
] as const;

export const BLOG_SECTIONS = [
  { value: "education-news",   label: "Education News"   },
  { value: "exam-prep",        label: "Exam Prep"        },
  { value: "career-guidance",  label: "Career Guidance"  },
  { value: "scholarship",      label: "Scholarship"      },
  { value: "study-abroad",     label: "Study Abroad"     },
  { value: "edtech",           label: "EdTech"           },
  { value: "student-life",     label: "Student Life"     },
  { value: "opinion",          label: "Opinion"          },
] as const;

export const POST_TYPES = [
  { value: "news",      label: "News"      },
  { value: "article",   label: "Article"   },
  { value: "guide",     label: "Guide"     },
  { value: "listicle",  label: "Listicle"  },
  { value: "opinion",   label: "Opinion"   },
  { value: "interview", label: "Interview" },
  { value: "analysis",  label: "Analysis"  },
  { value: "how-to",    label: "How-To"    },
] as const;

/** Hub content-type paths used in Menu Manager and revalidation */
export const CONTENT_HUB_PATHS = [
  { path: "/admit-card",      label: "Admit Card Hub"      },
  { path: "/results",         label: "Results Hub"         },
  { path: "/answer-key",      label: "Answer Key Hub"      },
  { path: "/date-sheet",      label: "Date Sheet Hub"      },
  { path: "/syllabus",        label: "Syllabus Hub"        },
  { path: "/previous-papers", label: "Previous Papers Hub" },
] as const;
