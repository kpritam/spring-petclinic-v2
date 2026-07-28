---
sidebar_position: 40
sidebar_label: IDE setup
---

# IDE setup

Import and run Spring PetClinic in Eclipse, IntelliJ IDEA, or VS Code.

## Eclipse / Spring Tools Suite

1. Install the [m2e Maven plugin](https://www.eclipse.org/m2e/) if not already present (bundled in Spring Tools Suite).
2. From the **File** menu choose **Import → Existing Maven Projects**.
3. Select the repository root directory and click **Finish**.
4. Eclipse resolves dependencies and configures the classpath automatically.
5. To run: right-click `PetClinicApplication.java` → **Run As → Spring Boot App** (Spring Tools Suite) or **Run As → Java Application**.

## IntelliJ IDEA

IntelliJ IDEA Ultimate includes built-in Spring Boot support. Community Edition works without the Spring-specific tooling.

1. Choose **File → Open** and select the repository root directory.
2. IntelliJ detects the Maven or Gradle build file and imports the project automatically.
3. To run: open `src/main/java/org/springframework/samples/petclinic/PetClinicApplication.java` and click the green **Run** gutter icon, or use the **Run** menu.

For live reload during development, Spring Boot Devtools is included in the project dependencies and activates automatically in the IDE.

## VS Code

1. Install the [Extension Pack for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack).
2. Install the [Spring Boot Extension Pack](https://marketplace.visualstudio.com/items?itemName=vmware.vscode-boot-dev-pack).
3. Open the repository root folder with **File → Open Folder**.
4. VS Code imports the Maven project and configures the Java classpath.
5. To run: open `PetClinicApplication.java` and press **F5**, or use the **Spring Boot Dashboard** panel.

## See also

- [Getting started](../getting-started) — run from the command line without an IDE
- [Configure a database](./configure-database) — use MySQL or PostgreSQL instead of H2
