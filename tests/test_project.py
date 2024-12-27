from app import ProjectData, app, session


def test_project_page():
    # Add a test client
    with app.test_client() as client:
        # Test GET request for a new project
        response = client.get("/project/10024683")
        assert response.status_code == 200
        assert b"Project ID: 10024683" in response.data

        # Test POST request to save data
        response = client.post(
            "/project/10024683",
            data={"data": "Test Comment", "complex": "yes"},
            follow_redirects=True,
        )
        assert response.status_code == 200

        # Verify data is updated in the database
        project = session.query(ProjectData).filter_by(project_id="10024683").first()

        assert project.data == "Test Comment"
        assert project.is_complex == "yes"

        # Test GET request to confirm saved data
        response = client.get("/project/10024683")
        assert b"Test Comment" in response.data
        assert b"Yes" in response.data  # Confirm dropdown value
