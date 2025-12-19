# RAPID Sample Use Cases

This directory contains practical examples for RAPID (Review & Assessment Powered by Intelligent Documentation). Each use case includes sample checklists and review documents to help you understand how to apply RAPID in real-world scenarios.

## Available Use Cases

### Use Case 001: House Maker Meeting Minutes (Consistency Check between Minutes and Floor Plans)

**Overview**: A use case for house makers to verify consistency between customer requirements recorded in meeting minutes and building floor plans.

**Included Files**:

- Checklist: Customer Meeting Minutes (PDF)
- Review Document: Building Floor Plan (PNG image)

**Application**: Efficiently verify that customer requirements are correctly reflected in design drawings, preventing design errors and miscommunications.

### Use Case 004: Internal Approval Request (IT Department)

**Overview**: A use case for IT departments to verify that internal approval requests meet company policies and approval standards.

**Included Files**:

- Checklist: Internal Approval Request Checklist (PDF)
- Review Document: Internal Approval Request (PDF)

**Application**: Check required items in approval requests and verify the appropriateness of approval processes, strengthening internal governance and improving operational efficiency.

### Use Case 005: Sustainability Assessment (Energy Efficiency Compliance)

**Overview**: A use case for sustainability teams to verify that equipment specifications meet energy efficiency standards and industry regulations such as ASHRAE 90.1 and IEC 60034-30-1.

**Included Files**:

- Checklist: Energy Efficiency Compliance Verification (PDF)
- Review Document: Equipment Specifications (PDF)
- Knowledge Base Sources: Technical calculation documents for HVAC, lighting systems, motor efficiency, and building envelope thermal performance (to be uploaded to a separate Bedrock Knowledge Base)

**Setup Instructions**:

1. Create a Bedrock Knowledge Base in your AWS account and upload the knowledge base sources (HVAC, lighting, motor, building envelope calculation documents)
2. Configure the tool configuration in RAPID to reference your Knowledge Base ID and enable code interpreter
3. Upload the checklist to RAPID
4. After checklist creation, assign the tool configuration to checklist items in the checklist detail interface
5. Execute the review

**Application**: Demonstrates Bedrock Knowledge Base search combined with code interpreter calculations to assess compliance with ambiguous sustainability criteria. The system performs automated standard lookups and compliance calculations for data-driven sustainability decisions.

## How to Use

1. Upload the checklist and review documents from each use case directory to the RAPID system
2. The system will automatically analyze the documents using AI and cross-reference them with the checklist
3. Review the results and make final human judgment as needed

## Important Notes

- These samples are created for learning and validation purposes
- Final decisions must always be made by qualified professionals with appropriate expertise
