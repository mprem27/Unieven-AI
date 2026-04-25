package com.unieven.auth_service.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Date;

@Document(collection = "users")
public class User {

    @Id
    private String id;

    private String username;
    private String email;
    private String password;

    private String name;
    private String bio;
    private String image;
    private String gender;

    private String role; // student, faculty, admin

    private String registerOTP;
    private String resetOTP;
    private Date otpExpires;

    private Boolean isPrivate = false; // ✅ default value

    private List<String> followers;
    private List<String> following;
    private List<String> savedPosts;

    // 🔥 GETTERS & SETTERS

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getRegisterOTP() { return registerOTP; }
    public void setRegisterOTP(String registerOTP) { this.registerOTP = registerOTP; }

    public String getResetOTP() { return resetOTP; }
    public void setResetOTP(String resetOTP) { this.resetOTP = resetOTP; }

    public Date getOtpExpires() { return otpExpires; }
    public void setOtpExpires(Date otpExpires) { this.otpExpires = otpExpires; }

    public Boolean getIsPrivate() { return isPrivate; }
    public void setIsPrivate(Boolean isPrivate) { this.isPrivate = isPrivate; }

    public List<String> getFollowers() { return followers; }
    public void setFollowers(List<String> followers) { this.followers = followers; }

    public List<String> getFollowing() { return following; }
    public void setFollowing(List<String> following) { this.following = following; }

    public List<String> getSavedPosts() { return savedPosts; }
    public void setSavedPosts(List<String> savedPosts) { this.savedPosts = savedPosts; }
}