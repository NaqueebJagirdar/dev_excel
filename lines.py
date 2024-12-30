import os


def count_lines(directory, extensions=None):
    total_lines = 0
    for root, _, files in os.walk(directory):
        for file in files:
            if extensions is None or file.endswith(tuple(extensions)):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        total_lines += sum(1 for _ in f)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
    return total_lines


project_dir = r"C:\Users\00090874\PycharmProjects\Tracker"
extensions = [".py", ".js", ".html", ".css"]
# Add extensions to count, or use None for all files
lines = count_lines(project_dir, extensions)
print(f"Total lines of code: {lines}")
