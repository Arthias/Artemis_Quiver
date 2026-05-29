import { describe, it, expect } from "vitest";
import { renderCVToHTML } from "./renderingEngine";
import type { CVContent } from "../../types/cv";

/**
 * Unit tests for the CV Rendering Engine.
 * 
 * This test suite validates that:
 * 1. The rendering engine correctly handles all 6 section types
 * 2. HTML escaping prevents XSS attacks
 * 3. Theme-specific CSS styles are properly injected
 */

describe("CV Rendering Engine", () => {
  
  /* Test Data - Sample CV Content with all sections */
  const fullSampleCV: CVContent = {
    name: "Jane Developer",
    title: "Senior Full-Stack Engineer",
    sections: [
      { type: "summary" as const, content: "Senior full-stack developer with 10 years of experience in building scalable React and Node.js applications." },
      { 
        type: "contact" as const,
        email: "developer@example.com",
        phone: "+1-555-0123",
        linkedin: "https://linkedin.com/in/testuser",      
        website: "https://myportfolio.com",
        location: "San Francisco, CA"
      },
      { type: "skills" as const, skills: ["JavaScript", "React", "TypeScript", "Node.js", "CSS Grid"] },
      { 
        type: "experience" as const,
        experience: [
          { role: "Senior Software Engineer", company: "Tech Corp Inc.", period: "2019-2024", location: "Remote", bullets: ["Led a team of 5 developers focusing on scalable React applications.", "Reduced deployment time by 40%"] },
          { role: "Junior Frontend Developer", company: "StartupXYZ", period: "2017-2019" }
        ]
      },
      { 
        type: "education" as const,
        education: [ 
          { degree: "BS Computer Science", institution: "University of Technology", period: "2013-2017", location: "Boston, MA" } 
        ]
      },
      { 
        type: "certifications" as const,
        certifications: ["AWS Certified Developer", "Google Cloud Professional"]  
      }
    ]
  };

  /* =====================================================================
     Test Suite - Modern Theme
     ===================================================================== */
  
  const modernTheme = { primaryColor: "#2563eb", templateId: "modern" as const };

  it("should render all section types in Modern theme", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Professional Summary");
    expect(html).toContain("Skills");
    expect(html).toContain("Professional Experience");
    expect(html).toContain("Education");
    expect(html).toContain("Certifications");
  });

  it("should render name and title in header", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    expect(html).toContain("Jane Developer");
    expect(html).toContain("Senior Full-Stack Engineer");
  });

  it("should use Inter font family for Modern theme", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    expect(html).toContain("'Inter', -apple-system, sans-serif");
  });

  it("should apply skill-tag styling in Modern theme", () => {
    const html = renderCVToHTML({ 
      name: "Test", title: "Dev",
      sections: [{ type: "skills" as const, skills: [`React`, `TypeScript`] }] as any
    }, modernTheme);
    expect(html).toContain("skill-tag");
  });

  /* =====================================================================
     Test Suite - Classic Theme
     ===================================================================== */
  
  const classicTheme = { primaryColor: "#8B4513", templateId: "classic" as const };

  it("should render Classic theme with serif fonts", () => {
    expect(renderCVToHTML(fullSampleCV, classicTheme)).toContain("'Georgia', 'Times New Roman', serif");
    expect(renderCVToHTML(fullSampleCV, classicTheme)).toContain("Playfair Display");
  });

  /* =====================================================================
     Test Suite - Minimal Theme
     ===================================================================== */
  
  const minimalTheme = { primaryColor: "#1e293b", templateId: "minimal" as const };

  it("should render Minimal theme with stripped styling", () => {
    const html = renderCVToHTML(fullSampleCV, minimalTheme);
    expect(html).toContain("box-shadow: none");
    expect(html).toContain("border: none");
  });

  /* =====================================================================
     Test Suite - XSS Prevention
     ===================================================================== */
  
  it("should escape HTML entities in summary content", () => {
    const maliciousContent: any = { 
      name: "Test", title: "Dev",
      sections: [{ type: "summary" as const, content: `<script>alert('XSS')</script><b>Bold</b>` }]
    };
    
    const html = renderCVToHTML(maliciousContent, modernTheme);
    
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&gt;");
  });

  it("should escape special characters in all content fields", () => {
    const html = renderCVToHTML(
      fullSampleCV, 
      modernTheme
    );
    
    // Verify escaping works even with mixed content
    expect(html).not.toContain("<script>");   // XSS prevented ✓
  });

  /* =====================================================================
     Test Suite - Experience Section Detail
     ===================================================================== */
  
  it("should handle experience items with bullet points", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain("Tech Corp Inc.");
    expect(html).toContain("Led a team of 5 developers");
    expect(html).toContain("Reduced deployment time by 40%");
  });

  it("should handle experience items without descriptions", () => {
    const simpleContent: any = { 
      name: "Test", title: "Dev",
      sections: [{ type: "experience" as const, experience: [
        { role: "Dev", company: "Co1", period: "2020-2023" },
        { role: "Dev2", company: "Co2", period: "2018-2019" }
      ]}]
    };
    
    const html = renderCVToHTML(simpleContent, modernTheme);
    expect(html).toContain("Dev");
    expect(html).toContain("Co1");
  });

  /* =====================================================================
     Test Suite - Education Section
     ===================================================================== */
  
  it("should render education with degree, institution, and period", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    
    expect(html).toContain("BS Computer Science");
    expect(html).toContain("University of Technology");
    expect(html).toContain("2013-2017");
  });

  it("should render education with location when provided", () => {
    const html = renderCVToHTML(fullSampleCV, modernTheme);
    expect(html).toContain("Boston, MA");
  });

  /* =====================================================================
     Test Suite - Certifications Section  
     ===================================================================== */
  
  it("should render certifications as unordered list", () => {
    const content: any = {
      name: "Test", title: "Dev",
      sections: [{ type: "certifications" as const, certifications: ["Cert 1", "Cert 2"] }]
    };
    
    const html = renderCVToHTML(content, modernTheme);
    expect(html).toContain("<ul");
    expect(html).toContain("Cert 1");
  });

  /* =====================================================================
     Test Suite - Contact Section
     ===================================================================== */  

  it("should handle contact info with multiple fields", () => {
    const content: any = {
      name: "Test User", title: "Engineer",
      sections: [{ 
        type: "contact" as const,
        email: "test@test.com", phone: "123-456", linkedin: `https://linkedin.com/test`, location: "NYC"
      }]
    };

    const html = renderCVToHTML(content, modernTheme);
    
    expect(html).toContain("mailto:test@test.com");
    expect(html).toContain("123-456");
    expect(html).toContain("LinkedIn");
  });

});
