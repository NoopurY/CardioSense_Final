import { SectionPage } from "@/components/dashboard/SectionPage";

export default function ProfilePage() {
  return (
    <SectionPage
      title="User Profile"
      subtitle="Personal data, medical history, and security controls"
      blocks={[
        { title: "Personal Details", text: "Update avatar, identity, and emergency contacts." },
        { title: "Medical History", text: "Maintain conditions, medications, and allergies list." },
        { title: "Security", text: "Change password and manage account lifecycle actions." },
      ]}
    />
  );
}
